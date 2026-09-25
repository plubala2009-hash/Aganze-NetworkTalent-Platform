(() => {
  'use strict';
  const cfg = window.AGANZE_SUPABASE_CONFIG;
  if (!cfg || !window.supabase) return;
  const client = window.supabase.createClient(cfg.url, cfg.anonKey);
  const value = (form, name) => form.elements[name]?.value?.trim() || '';
  const esc = text => String(text ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[c]);
  const alertUser = (text, error = false) => { let el = document.querySelector('.site-alert'); if (!el) { el = document.createElement('div'); el.className = 'site-alert'; document.body.appendChild(el); } el.textContent = text; el.dataset.type = error ? 'error' : 'success'; };
  const currentUser = async () => (await client.auth.getUser()).data.user;
  const profileFor = async user => (await client.from('profiles').select('id,role,is_verified,verification_status,is_public').eq('id', user.id).maybeSingle()).data;

  async function loadCandidateRequests() {
    const user = await currentUser(); if (!user) return location.href = 'login.html';
    const container = document.querySelector('[data-request-list]'); if (!container) return;
    const { data, error } = await client.from('contact_requests').select('id,company_id,subject,message,status,created_at,company:company_id(full_name,company_name)').eq('candidate_id', user.id).order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data || [];
    container.innerHTML = rows.length ? rows.map(item => `
      <article class="feature-card">
        <h3>${esc(item.company?.company_name || item.company?.full_name || 'Company')}</h3>
        <p><strong>${esc(item.subject)}</strong></p>
        <p>${esc(item.message)}</p>
        <p>Status: ${esc(item.status)}</p>
        <div>
          <button data-request-action="accept" data-request-id="${item.id}" class="button small" type="button">Accept</button>
          <button data-request-action="decline" data-request-id="${item.id}" class="button small ghost" type="button">Decline</button>
          <button data-request-action="report" data-request-id="${item.id}" class="button small ghost" type="button">Report</button>
        </div>
      </article>
    `).join('') : '<p>No employer requests yet.</p>';
  }

  async function respondToRequest(id, action) {
    const user = await currentUser(); if (!user) return location.href = 'login.html';
    const status = action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'pending';
    if (action === 'report') {
      const reason = prompt('Why are you reporting this request?');
      if (!reason) return;
      const { error } = await client.from('reports').insert({ reporter_id: user.id, reason: `Request ${id}: ${reason}` });
      if (error) throw error;
      return alertUser('Report submitted for review.');
    }
    const { error } = await client.from('contact_requests').update({ status }).eq('id', id).eq('candidate_id', user.id);
    if (error) throw error;
    alertUser(action === 'accept' ? 'Request accepted. The company can now contact you.' : 'Request declined.');
    await loadCandidateRequests();
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
        <p>Status: ${esc(item.status)}</p>
      </article>
    `).join('') : '<p>No requests sent yet.</p>';
  }

  document.addEventListener('click', async event => {
    const action = event.target.closest('[data-request-action]');
    if (action) { await respondToRequest(action.dataset.requestId, action.dataset.requestAction); return; }
    if (event.target.closest('[data-logout]')) { await client.auth.signOut(); location.href = 'index.html'; }
  });

  (async () => {
    try {
      const page = document.body.dataset.page;
      const user = await currentUser();
      if (!user) return location.href = 'login.html';
      if (page === 'candidate-requests') await loadCandidateRequests();
      if (page === 'contact-requests') await loadCompanyRequests();
    } catch (error) {
      alertUser(error.message || 'Unable to load requests.', true);
    }
  })();
})();
