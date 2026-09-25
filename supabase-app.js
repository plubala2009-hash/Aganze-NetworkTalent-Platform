(() => {
  'use strict';
  const cfg = window.AGANZE_SUPABASE_CONFIG;
  if (!cfg || !window.supabase) return;
  const client = window.supabase.createClient(cfg.url, cfg.anonKey);
  window.aganzeSupabase = client;

  const alertUser = (text, error = false) => {
    let el = document.querySelector('.site-alert');
    if (!el) { el = document.createElement('div'); el.className = 'site-alert'; document.body.appendChild(el); }
    el.textContent = text; el.dataset.type = error ? 'error' : 'success';
  };
  const value = (form, name) => form.elements[name]?.value?.trim() || '';
  const esc = text => String(text ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[c]);
  const redirectFor = role => role === 'company' ? 'company-dashboard.html' : 'candidate-dashboard.html';
  const currentUser = async () => (await client.auth.getUser()).data.user;
  const profileFor = async user => (await client.from('profiles').select('id,role,is_verified,verification_status,is_public').eq('id', user.id).maybeSingle()).data;

  async function signup(form) {
    const email = value(form, 'email'), password = value(form, 'password'), fullName = value(form, 'full_name');
    const role = value(form, 'role') === 'company' ? 'company' : 'candidate';
    if (!email || !fullName || password.length < 8) throw new Error('Use your name, a valid email, and a password of at least 8 characters.');
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: fullName, requested_role: role } } });
    if (error) throw error;
    if (data.session) {
      const result = await client.from('profiles').upsert({ id: data.user.id, full_name: fullName, role });
      if (result.error) throw result.error;
      location.href = redirectFor(role);
    } else alertUser('Account created. Check your email before logging in.');
  }

  async function login(form) {
    const { data, error } = await client.auth.signInWithPassword({ email: value(form, 'email'), password: value(form, 'password') });
    if (error) throw error;
    const profile = await profileFor(data.user);
    if (!profile) throw new Error('Your account profile is not ready yet. Please contact support.');
    location.href = redirectFor(profile.role);
  }

  async function saveProfile(form) {
    const user = await currentUser(); if (!user) return (location.href = 'login.html');
    const skills = value(form, 'skills').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).slice(0, 30);
    const payload = { id: user.id, full_name: value(form, 'full_name'), headline: value(form, 'headline'), bio: value(form, 'bio'), location: value(form, 'location'), website: value(form, 'website'), skills, is_public: form.elements.is_public?.checked === true };
    const { error } = await client.from('profiles').update(payload).eq('id', user.id);
    if (error) throw error; alertUser('Profile saved.');
  }

  async function upload(form) {
    const user = await currentUser(); if (!user) return (location.href = 'login.html');
    const file = form.elements.file?.files?.[0];
    const allowed = ['application/pdf','image/png','image/jpeg','text/plain','application/zip'];
    if (!file || file.size > 10 * 1024 * 1024 || !allowed.includes(file.type)) throw new Error('Choose a PDF, image, text, or ZIP file up to 10 MB.');
    const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const uploaded = await client.storage.from('simulations').upload(path, file); if (uploaded.error) throw uploaded.error;
    const result = await client.from('simulations').insert({ user_id: user.id, title: value(form, 'title'), description: value(form, 'description'), category: value(form, 'category'), issuer_name: value(form, 'issuer_name'), evidence_url: value(form, 'evidence_url'), file_path: path, file_name: file.name, is_public: form.elements.is_public?.checked === true }).select().single();
    if (result.error) { await client.storage.from('simulations').remove([path]); throw result.error; }
    form.reset(); alertUser('Evidence submitted for review. It will be visible only after approval.');
  }

  async function loadCompanyDashboard() {
    const user = await currentUser(); if (!user) return (location.href = 'login.html');
    const profile = await profileFor(user);
    if (!profile || profile.role !== 'company') return (location.href = 'candidate-dashboard.html');
    const el = document.querySelector('[data-candidate-count]');
    const { count, error } = await client.from('public_candidate_profiles').select('id', { count: 'exact', head: true });
    if (error) throw error; if (el) el.textContent = `${count || 0} public candidates available`;
    document.querySelectorAll('[data-company-status]').forEach(node => node.textContent = profile.is_verified ? 'Verified company' : 'Verification pending');
  }

  async function loadFeed() {
    const container = document.querySelector('[data-talent-list]'); if (!container) return;
    const user = await currentUser();
    const profile = user && await profileFor(user);
    if (!profile || profile.role !== 'company' || !profile.is_verified) { container.innerHTML = '<p>Verified company accounts can explore candidate profiles. Please complete company verification.</p>'; return; }
    const query = new URLSearchParams(location.search), skill = query.get('skill') || '';
    let request = client.from('public_candidate_profiles').select('id,full_name,headline,bio,location,skills,is_verified').order('updated_at', { ascending: false }).limit(50);
    if (skill) request = request.contains('skills', [skill.toLowerCase()]);
    const { data, error } = await request; if (error) throw error;
    container.innerHTML = data?.length ? data.map(p => `<article class="feature-card"><div class="card-icon">✦</div><h3>${esc(p.full_name || 'Aganze member')} ${p.is_verified ? '<small aria-label="verified">✓</small>' : ''}</h3><p>${esc(p.headline || p.bio || 'Candidate profile')}</p><p>${esc((p.skills || []).join(' · '))}</p><a class="button small" href="candidate-detail.html?id=${encodeURIComponent(p.id)}">View profile</a></article>`).join('') : '<p>No public candidates match this search yet.</p>';
  }

  async function loadCandidateDetail() {
    const id = new URLSearchParams(location.search).get('id'); const container = document.querySelector('[data-candidate-detail]'); if (!id || !container) return;
    const user = await currentUser(); const viewer = user && await profileFor(user);
    if (!viewer || viewer.role !== 'company' || !viewer.is_verified) return (container.innerHTML = '<p>Only verified companies can view candidate details.</p>');
    const { data: p, error } = await client.from('public_candidate_profiles').select('*').eq('id', id).single(); if (error) throw error;
    const evidence = await client.from('simulations').select('id,title,description,category,issuer_name,completed_on,verification_status').eq('user_id', id).eq('is_public', true).eq('verification_status', 'approved');
    container.innerHTML = `<h1>${esc(p.full_name)} ${p.is_verified ? '✓' : ''}</h1><p class="lead">${esc(p.headline || '')}</p><p>${esc(p.bio || '')}</p><p><strong>Location:</strong> ${esc(p.location || 'Not provided')}</p><p><strong>Skills:</strong> ${esc((p.skills || []).join(' · '))}</p><h2>Verified evidence</h2>${evidence.data?.length ? evidence.data.map(e => `<article class="feature-card"><h3>${esc(e.title)} <small>Verified</small></h3><p>${esc(e.description || '')}</p><p>${esc(e.category || '')} ${esc(e.issuer_name || '')}</p></article>`).join('') : '<p>No approved public evidence yet.</p>'}<form data-supabase="contact-request"><input type="hidden" name="candidate_id" value="${esc(id)}"><label>Subject<input name="subject" required maxlength="160"></label><label>Message<textarea name="message" required minlength="10" maxlength="5000"></textarea></label><button class="button" type="submit">Send contact request</button></form>`;
  }

  async function contactRequest(form) {
    const user = await currentUser(); if (!user) return (location.href = 'login.html');
    const profile = await profileFor(user); if (!profile?.is_verified || profile.role !== 'company') throw new Error('Only verified companies can contact candidates.');
    const { error } = await client.from('contact_requests').insert({ company_id: user.id, candidate_id: value(form, 'candidate_id'), subject: value(form, 'subject'), message: value(form, 'message') });
    if (error) throw error; form.reset(); alertUser('Request sent. The candidate can accept or decline it.');
  }

  document.addEventListener('submit', async event => { const form = event.target, action = form.dataset.supabase; if (!action) return; event.preventDefault(); const button = form.querySelector('button[type="submit"]'); if (button) button.disabled = true; try { await ({ signup, login, profile: saveProfile, upload, 'contact-request': contactRequest }[action])(form); } catch (error) { alertUser(error.message || 'Something went wrong.', true); } finally { if (button) button.disabled = false; } });
  document.addEventListener('click', async event => { if (event.target.closest('[data-logout]')) { await client.auth.signOut(); location.href = 'index.html'; } });
  (async () => { try { const page = document.body.dataset.page, user = await currentUser(); if (document.body.hasAttribute('data-auth-required') && !user) return (location.href = 'login.html'); if (page === 'company-dashboard') await loadCompanyDashboard(); if (page === 'talent-feed') await loadFeed(); if (page === 'candidate-detail') await loadCandidateDetail(); } catch (error) { alertUser(error.message || 'Unable to load this page.', true); } })();
})();
