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
  const redirectFor = role => role === 'company' ? 'company-dashboard.html' : 'candidate-dashboard.html';
  const currentUser = async () => (await client.auth.getUser()).data.user;

  async function signup(form) {
    const email = value(form, 'email'), password = value(form, 'password');
    const fullName = value(form, 'full_name');
    const role = value(form, 'role') === 'company' ? 'company' : 'candidate';
    if (password.length < 6) throw new Error('Password must contain at least 6 characters.');
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: fullName, role } } });
    if (error) throw error;
    if (data.session) {
      await client.from('profiles').upsert({ id: data.user.id, full_name: fullName, role });
      location.href = redirectFor(role);
    } else alertUser('Account created. Check your email, then log in to continue.');
  }

  async function login(form) {
    const { data, error } = await client.auth.signInWithPassword({ email: value(form, 'email'), password: value(form, 'password') });
    if (error) throw error;
    const { data: profile } = await client.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    if (!profile) await client.from('profiles').upsert({ id: data.user.id, full_name: data.user.user_metadata?.full_name || '', role: data.user.user_metadata?.role || 'candidate' });
    location.href = redirectFor(profile?.role || data.user.user_metadata?.role);
  }

  async function saveProfile(form) {
    const user = await currentUser();
    if (!user) return (location.href = 'login.html');
    const { data: existing } = await client.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const payload = { id: user.id, full_name: value(form, 'full_name'), headline: value(form, 'headline'), bio: value(form, 'bio'), location: value(form, 'location'), website: value(form, 'website'), skills: value(form, 'skills').split(',').map(s => s.trim()).filter(Boolean), role: existing?.role || user.user_metadata?.role || 'candidate', updated_at: new Date().toISOString() };
    const { error } = await client.from('profiles').upsert(payload);
    if (error) throw error;
    alertUser('Profile saved successfully.');
  }

  async function upload(form) {
    const user = await currentUser();
    if (!user) return (location.href = 'login.html');
    const file = form.elements.file?.files?.[0];
    if (!file) throw new Error('Choose a file to upload.');
    const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: fileError } = await client.storage.from('simulations').upload(path, file);
    if (fileError) throw fileError;
    const category = value(form, 'category');
    const description = [category && `Category: ${category}`, value(form, 'description')].filter(Boolean).join('\n\n');
    const { error } = await client.from('simulations').insert({ user_id: user.id, title: value(form, 'title'), description, file_path: path, file_name: file.name });
    if (error) { await client.storage.from('simulations').remove([path]); throw error; }
    form.reset(); alertUser('Simulation published successfully.');
  }

  async function contact(form) {
    const { error } = await client.from('contact_messages').insert({ name: value(form, 'name'), email: value(form, 'email'), message: value(form, 'message') });
    if (error) throw error;
    form.reset(); alertUser('Thanks — your message has been sent.');
  }

  async function loadProfile() {
    const user = await currentUser();
    if (!user) return (location.href = 'login.html');
    const { data } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (!data) return;
    const form = document.querySelector('[data-supabase="profile"]');
    if (form) Object.entries({ ...data, skills: (data.skills || []).join(', ') }).forEach(([key, val]) => { if (form.elements[key]) form.elements[key].value = val || ''; });
    document.querySelectorAll('[data-profile-name]').forEach(el => el.textContent = data.full_name || user.email);
  }

  async function loadCandidateDashboard() {
    const user = await currentUser(); if (!user) return (location.href = 'login.html');
    const [{ data: profile }, { data: simulations }] = await Promise.all([
      client.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      client.from('simulations').select('id').eq('user_id', user.id)
    ]);
    document.querySelector('[data-profile-name]').textContent = profile?.full_name || user.email;
    document.querySelector('[data-project-count]').textContent = `${simulations?.length || 0} items published`;
    const fields = [profile?.full_name, profile?.headline, profile?.bio, profile?.location, ...(profile?.skills || [])];
    const completion = Math.round(fields.filter(Boolean).length / 7 * 100);
    document.querySelector('[data-profile-completion]').textContent = `${completion}% complete`;
  }

  async function loadCompanyDashboard() {
    const user = await currentUser(); if (!user) return (location.href = 'login.html');
    const { count } = await client.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'candidate');
    document.querySelector('[data-candidate-count]').textContent = `${count || 0} candidates available`;
  }

  async function loadFeed() {
    const container = document.querySelector('[data-talent-list]'); if (!container) return;
    const { data, error } = await client.from('profiles').select('id,full_name,headline,bio,location,skills').eq('role', 'candidate').order('updated_at', { ascending: false });
    if (error) return alertUser(error.message, true);
    container.innerHTML = data?.length ? data.map(profile => `<article class="feature-card"><div class="card-icon">✦</div><h3>${escapeHtml(profile.full_name || 'Aganze member')}</h3><p>${escapeHtml(profile.headline || 'Skills-first professional')}</p><small>${escapeHtml((profile.skills || []).join(' · ') || profile.location || 'Profile in progress')}</small></article>`).join('') : '<p>No candidate profiles are available yet.</p>';
  }
  const escapeHtml = text => String(text).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[c]);

  document.addEventListener('submit', async event => {
    const form = event.target, action = form.dataset.supabase;
    if (!action) return;
    event.preventDefault(); const button = form.querySelector('button[type="submit"]'); if (button) button.disabled = true;
    try { await ({ signup, login, contact, profile: saveProfile, upload }[action])(form); } catch (error) { alertUser(error.message || 'Something went wrong.', true); } finally { if (button) button.disabled = false; }
  });
  document.addEventListener('click', async event => { if (event.target.matches('[data-logout]')) { await client.auth.signOut(); location.href = 'index.html'; } });
  (async () => {
    const page = document.body.dataset.page;
    const user = await currentUser();
    if (document.body.hasAttribute('data-auth-required') && !user) return (location.href = 'login.html');
    document.querySelectorAll('[data-user-email]').forEach(el => el.textContent = user?.email || '');
    if (page === 'profile') await loadProfile();
    if (page === 'candidate-dashboard') await loadCandidateDashboard();
    if (page === 'company-dashboard') await loadCompanyDashboard();
    if (page === 'talent-feed') await loadFeed();
  })();
})();
