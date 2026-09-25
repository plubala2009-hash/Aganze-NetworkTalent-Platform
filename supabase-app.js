(() => {
  'use strict';
  const cfg = window.AGANZE_SUPABASE_CONFIG;
  if (!cfg || !window.supabase) return;
  const client = window.supabase.createClient(cfg.url, cfg.anonKey);
  window.aganzeSupabase = client;

  const alertUser = (text, error = false) => {
    let el = document.querySelector('.site-alert');
    if (!el) { el = document.createElement('div'); el.className = 'site-alert'; document.body.appendChild(el); }
    el.textContent = text;
    el.dataset.type = error ? 'error' : 'success';
  };
  const value = (form, name) => form.elements[name]?.value?.trim() || '';
  const esc = text => String(text ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[c]);
  const badge = (text, tone = 'success') => `<span class="trust-badge ${tone}">${esc(text)}</span>`;
  const redirectFor = role => role === 'company' ? 'company-dashboard.html' : 'candidate-dashboard.html';
  const currentUser = async () => (await client.auth.getUser()).data.user;
  const profileFor = async user => (await client.from('profiles').select('id,role,is_verified,verification_status,is_public,full_name,company_name,headline').eq('id', user.id).maybeSingle()).data;

  async function signup(form) {
    const email = value(form, 'email'), password = value(form, 'password'), fullName = value(form, 'full_name');
    const role = value(form, 'role') === 'company' ? 'company' : 'candidate';
    if (!email || !fullName || password.length < 8) throw new Error('Use your name, a valid email, and a password of at least 8 characters.');
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: fullName, requested_role: role } } });
    if (error) throw error;
    if (!data.session) return alertUser('Account created. Check your email before logging in.');
    const result = await client.from('profiles').upsert({ id: data.user.id, full_name: fullName, role });
    if (result.error) throw result.error;
    location.href = redirectFor(role);
  }

  async function login(form) {
    const { data, error } = await client.auth.signInWithPassword({ email: value(form, 'email'), password: value(form, 'password') });
    if (error) throw error;
    const profile = await profileFor(data.user);
    if (!profile) throw new Error('Your profile is not ready yet. Please contact support.');
    location.href = redirectFor(profile.role);
  }

  async function saveProfile(form) {
    const user = await currentUser(); if (!user) return location.href = 'login.html';
    const skills = value(form, 'skills').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).slice(0, 30);
    const payload = {
      full_name: value(form, 'full_name'),
      headline: value(form, 'headline'),
      bio: value(form, 'bio'),
      location: value(form, 'location'),
      website: value(form, 'website'),
      skills,
      is_public: form.elements.is_public?.checked === true
    };
    const { error } = await client.from('profiles').update(payload).eq('id', user.id);
    if (error) throw error;
    alertUser('Profile saved.');
  }

  async function upload(form) {
    const user = await currentUser(); if (!user) return location.href = 'login.html';
    const file = form.elements.file?.files?.[0];
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'application/zip'];
    if (!file || file.size > 10 * 1024 * 1024 || !allowed.includes(file.type)) throw new Error('Choose a PDF, image, text, or ZIP file up to 10 MB.');
    const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const uploaded = await client.storage.from('simulations').upload(path, file);
    if (uploaded.error) throw uploaded.error;
    const result = await client.from('simulations').insert({
      user_id: user.id,
      title: value(form, 'title'),
      description: value(form, 'description'),
      category: value(form, 'category'),
      issuer_name: value(form, 'issuer_name'),
      evidence_url: value(form, 'evidence_url'),
      completed_on: value(form, 'completed_on') || null,
      file_path: path,
      file_name: file.name,
      is_public: false
    });
    if (result.error) { await client.storage.from('simulations').remove([path]); throw result.error; }
    form.reset();
    alertUser('Evidence submitted for review.');
  }

  async function companyVerification(form) {
    const user = await currentUser(); if (!user) return location.href = 'login.html';
    const payload = {
      company_id: user.id,
      legal_name: value(form, 'legal_name'),
      website: value(form, 'website'),
      registration_number: value(form, 'registration_number'),
      business_email: value(form, 'business_email'),
      explanation: value(form, 'explanation')
    };
    const { error } = await client.from('company_verification_submissions').insert(payload);
    if (error) throw error;
    form.reset();
    alertUser('Verification request submitted. Our team will review it.');
  }

  async function loadCandidateDashboard() {
    const user = await currentUser(); if (!user) return location.href = 'login.html';
    const profile = await profileFor(user);
    const { data: evidence, error: evidenceError } = await client.from('simulations').select('id,title,verification_status,created_at,is_public').eq('user_id', user.id).order('created_at', { ascending: false });
    if (evidenceError) throw evidenceError;

    const statusNode = document.querySelector('[data-profile-status]');
    if (statusNode) {
      statusNode.innerHTML = badge(profile?.is_verified ? 'Verified candidate' : (profile?.verification_status || 'Pending verification'), profile?.is_verified ? 'success' : 'warning');
    }

    const evidenceList = document.querySelector('[data-evidence-list]');
    if (evidenceList) {
      evidenceList.innerHTML = evidence?.length ? evidence.map(item => `
        <article class="feature-card">
          <h3>${esc(item.title)}</h3>
          <p>${badge(item.verification_status === 'approved' ? 'Approved' : item.verification_status === 'rejected' ? 'Rejected' : 'Pending review', item.verification_status === 'approved' ? 'success' : item.verification_status === 'rejected' ? 'error' : 'warning')}</p>
          <p>${item.is_public ? 'Publicly visible' : 'Private until approved'}</p>
        </article>
      `).join('') : '<p>No evidence submitted yet.</p>';
    }

    const scoreNode = document.querySelector('[data-profile-completion]');
    if (scoreNode) {
      const fields = [profile?.full_name, profile?.headline, profile?.bio, profile?.location, ...(profile?.skills || [])];
      const completion = Math.round((fields.filter(Boolean).length / 7) * 100);
      scoreNode.textContent = `${completion}% profile completion`;
    }
  }

  async function loadCompanyDashboard() {
    const user = await currentUser(); if (!user) return location.href = 'login.html';
    const profile = await profileFor(user);
    const { count, error } = await client.from('public_candidate_profiles').select('id', { count: 'exact', head: true });
    if (error) throw error;
    const statusNode = document.querySelector('[data-company-status]');
    if (statusNode) {
      statusNode.innerHTML = badge(profile?.is_verified ? 'Verified employer' : 'Verification pending', profile?.is_verified ? 'success' : 'warning');
    }
    const countNode = document.querySelector('[data-candidate-count]');
    if (countNode) countNode.textContent = `${count || 0} public candidates available`;
  }

  async function loadFeed() {
    const container = document.querySelector('[data-talent-list]'); if (!container) return;
    const { data, error } = await client.from('public_candidate_profiles').select('id,full_name,headline,bio,location,skills,is_verified').order('updated_at', { ascending: false }).limit(50);
    if (error) throw error;
    container.innerHTML = data?.length ? data.map(profile => `
      <article class="feature-card">
        <div class="card-icon">✦</div>
        <h3>${esc(profile.full_name || 'Aganze member')} ${badge(profile.is_verified ? 'Verified' : 'In review', profile.is_verified ? 'success' : 'warning')}</h3>
        <p>${esc(profile.headline || profile.bio || 'Candidate profile')}</p>
        <p>${esc((profile.skills || []).join(' · ') || 'Skills not yet listed')}</p>
        <a class="button small" href="candidate-detail.html?id=${encodeURIComponent(profile.id)}">View profile</a>
      </article>
    `).join('') : '<p>No public candidates match this search yet.</p>';
  }

  async function loadCandidateDetail() {
    const id = new URLSearchParams(location.search).get('id');
    const container = document.querySelector('[data-candidate-detail]');
    if (!id || !container) return;
    const user = await currentUser();
    const viewer = user && await profileFor(user);
    if (!viewer || viewer.role !== 'company' || !viewer.is_verified) {
      container.innerHTML = '<p>Only verified companies can view candidate details.</p>';
      return;
    }
    const { data: profile, error: profileError } = await client.from('public_candidate_profiles').select('*').eq('id', id).single();
    if (profileError) throw profileError;
    const { data: evidence } = await client.from('simulations').select('title,description,category,issuer_name,completed_on,verification_status').eq('user_id', id).eq('is_public', true).eq('verification_status', 'approved');
    container.innerHTML = `
      <div class="feature-card">
        <h1>${esc(profile.full_name || 'Candidate')} ${badge(profile.is_verified ? 'Verified' : 'In review', profile.is_verified ? 'success' : 'warning')}</h1>
        <p class="lead">${esc(profile.headline || '')}</p>
        <p>${esc(profile.bio || '')}</p>
        <p><strong>Location:</strong> ${esc(profile.location || 'Not provided')}</p>
        <p><strong>Skills:</strong> ${esc((profile.skills || []).join(' · '))}</p>
      </div>
      <h2>Approved evidence</h2>
      ${evidence?.length ? evidence.map(item => `
        <article class="feature-card">
          <h3>${esc(item.title)}</h3>
          <p>${esc(item.category || '')} · ${esc(item.issuer_name || 'Issuer not supplied')}</p>
          <p>${esc(item.description || '')}</p>
        </article>
      `).join('') : '<p>No approved public evidence yet.</p>'}
    `;
  }

  async function loadCandidateRequests() {
    const user = await currentUser(); if (!user) return location.href = 'login.html';
    const container = document.querySelector('[data-request-list]'); if (!container) return;
    const { data, error } = await client.from('contact_requests').select('id,company_id,subject,message,status,created_at,company:company_id(full_name,company_name)').eq('candidate_id', user.id).order('created_at', { ascending: false });
    if (error) throw error;
    container.innerHTML = data?.length ? data.map(item => `
      <article class="feature-card">
        <h3>${esc(item.company?.company_name || item.company?.full_name || 'Company')}</h3>
        <p><strong>${esc(item.subject)}</strong></p>
        <p>${esc(item.message)}</p>
        <p>${badge(item.status === 'accepted' ? 'Accepted' : item.status === 'declined' ? 'Declined' : 'Pending', item.status === 'accepted' ? 'success' : item.status === 'declined' ? 'error' : 'warning')}</p>
        <div>
          <button data-request-action="accept" data-request-id="${item.id}" class="button small" type="button">Accept</button>
          <button data-request-action="decline" data-request-id="${item.id}" class="button small ghost" type="button">Decline</button>
          <button data-request-action="report" data-request-id="${item.id}" class="button small ghost" type="button">Report</button>
        </div>
      </article>
    `).join('') : '<p>No employer requests yet.</p>';
  }

  async function loadCompanyRequests() {
    const user = await currentUser(); if (!user) return location.href = 'login.html';
    const container = document.querySelector('[data-request-list]'); if (!container) return;
    const { data, error } = await client.from('contact_requests').select('id,candidate_id,subject,message,status,created_at,candidate:candidate_id(full_name)').eq('company_id', user.id).order('created_at', { ascending: false });
    if (error) throw error;
    container.innerHTML = data?.length ? data.map(item => `
      <article class="feature-card">
        <h3>${esc(item.candidate?.full_name || 'Candidate')}</h3>
        <p><strong>${esc(item.subject)}</strong></p>
        <p>${esc(item.message)}</p>
        <p>${badge(item.status === 'accepted' ? 'Accepted' : item.status === 'declined' ? 'Declined' : 'Pending', item.status === 'accepted' ? 'success' : item.status === 'declined' ? 'error' : 'warning')}</p>
      </article>
    `).join('') : '<p>No requests sent yet.</p>';
  }

  async function respondToRequest(id, action) {
    const user = await currentUser(); if (!user) return location.href = 'login.html';
    if (action === 'report') {
      const reason = prompt('Why are you reporting this request?');
      if (!reason) return;
      const { error } = await client.from('reports').insert({ reporter_id: user.id, reason: `Request ${id}: ${reason}` });
      if (error) throw error;
      return alertUser('Report submitted for review.');
    }
    const status = action === 'accept' ? 'accepted' : 'declined';
    const { error } = await client.from('contact_requests').update({ status }).eq('id', id).eq('candidate_id', user.id);
    if (error) throw error;
    alertUser(action === 'accept' ? 'Request accepted. The company can now contact you.' : 'Request declined.');
    await loadCandidateRequests();
  }

  document.addEventListener('submit', async event => {
    const form = event.target, action = form.dataset.supabase;
    if (!action) return;
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      await ({ signup, login, profile: saveProfile, upload, 'company-verification': companyVerification }[action])(form);
    } catch (error) {
      alertUser(error.message || 'Something went wrong.', true);
    } finally {
      if (button) button.disabled = false;
    }
  });

  document.addEventListener('click', async event => {
    const requestAction = event.target.closest('[data-request-action]');
    if (requestAction) {
      await respondToRequest(requestAction.dataset.requestId, requestAction.dataset.requestAction);
      return;
    }
    if (event.target.closest('[data-logout]')) {
      await client.auth.signOut();
      location.href = 'index.html';
    }
  });

  (async () => {
    try {
      const page = document.body.dataset.page;
      const user = await currentUser();
      if (document.body.hasAttribute('data-auth-required') && !user) return location.href = 'login.html';
      if (page === 'candidate-dashboard') await loadCandidateDashboard();
      if (page === 'company-dashboard') await loadCompanyDashboard();
      if (page === 'talent-feed') await loadFeed();
      if (page === 'candidate-detail') await loadCandidateDetail();
      if (page === 'candidate-requests') await loadCandidateRequests();
      if (page === 'contact-requests') await loadCompanyRequests();
      if (page === 'company-verification') {
        const statusNode = document.querySelector('[data-verification-status]');
        if (statusNode && user) {
          const entries = await client.from('company_verification_submissions').select('status, created_at').eq('company_id', user.id).order('created_at', { ascending: false }).limit(1);
          if (entries.data?.[0]) statusNode.innerHTML = `<p>${badge(entries.data[0].status === 'approved' ? 'Verified employer' : entries.data[0].status === 'rejected' ? 'Rejected' : 'Pending review', entries.data[0].status === 'approved' ? 'success' : entries.data[0].status === 'rejected' ? 'error' : 'warning')}</p>`;
        }
      }
    } catch (error) {
      alertUser(error.message || 'Unable to load this page.', true);
    }
  })();
})();
