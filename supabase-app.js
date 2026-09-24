(() => {
  'use strict';
  const cfg = window.AGANZE_SUPABASE_CONFIG;
  if (!cfg || !window.supabase) return;
  const client = window.supabase.createClient(cfg.url, cfg.anonKey);
  window.aganzeSupabase = client;

  const message = (text, error = false) => {
    let el = document.querySelector('.site-alert');
    if (!el) { el = document.createElement('div'); el.className = 'site-alert'; document.body.appendChild(el); }
    el.textContent = text;
    el.dataset.type = error ? 'error' : 'success';
  };
  const value = (form, name) => form.elements[name]?.value?.trim() || '';
  const redirectFor = role => role === 'company' ? 'company-dashboard.html' : 'candidate-dashboard.html';

  async function signup(form) {
    const email = value(form, 'email'), password = value(form, 'password');
    const fullName = value(form, 'full_name'), role = value(form, 'role').toLowerCase().includes('employer') || value(form, 'role').toLowerCase().includes('company') ? 'company' : 'candidate';
    if (!email || !password || password.length < 6) throw new Error('Enter a valid email and a password of at least 6 characters.');
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: fullName, role } } });
    if (error) throw error;
    if (data.user) {
      const { error: profileError } = await client.from('profiles').upsert({ id: data.user.id, full_name: fullName, role });
      if (profileError) throw profileError;
    }
    message(data.session ? 'Account created. Redirecting…' : 'Account created. Check your email to confirm it.');
    if (data.session) setTimeout(() => location.href = redirectFor(role), 700);
  }

  async function login(form) {
    const { data, error } = await client.auth.signInWithPassword({ email: value(form, 'email'), password: value(form, 'password') });
    if (error) throw error;
    const { data: profile } = await client.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    location.href = redirectFor(profile?.role);
  }

  async function contact(form) {
    const { error } = await client.from('contact_messages').insert({ name: value(form, 'name'), email: value(form, 'email'), message: value(form, 'message') });
    if (error) throw error;
    form.reset(); message('Thanks — your message has been sent.');
  }

  async function profile(form) {
    const { data: { user } } = await client.auth.getUser();
    if (!user) { location.href = 'login.html'; return; }
    const payload = { id: user.id, full_name: value(form, 'full_name'), headline: value(form, 'headline'), bio: value(form, 'bio'), location: value(form, 'location'), website: value(form, 'website'), skills: value(form, 'skills').split(',').map(x => x.trim()).filter(Boolean), updated_at: new Date().toISOString() };
    const { error } = await client.from('profiles').upsert(payload);
    if (error) throw error;
    message('Profile saved.');
  }

  async function upload(form) {
    const { data: { user } } = await client.auth.getUser();
    if (!user) { location.href = 'login.html'; return; }
    const file = form.elements.file?.files?.[0];
    if (!file) throw new Error('Choose a file to upload.');
    const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadError } = await client.storage.from('simulations').upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;
    const { error } = await client.from('simulations').insert({ user_id: user.id, title: value(form, 'title'), description: value(form, 'description'), file_path: path, file_name: file.name });
    if (error) throw error;
    form.reset(); message('Simulation published.');
  }

  document.addEventListener('submit', async event => {
    const form = event.target;
    const action = form.dataset.supabase;
    if (!action) return;
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    if (button) button.disabled = true;
    try { await ({ signup, login, contact, profile, upload }[action])(form); }
    catch (error) { message(error.message || 'Something went wrong.', true); }
    finally { if (button) button.disabled = false; }
  });

  client.auth.getUser().then(({ data: { user } }) => {
    document.querySelectorAll('[data-auth-required]').forEach(el => { if (!user) location.href = 'login.html'; });
    document.querySelectorAll('[data-user-email]').forEach(el => { el.textContent = user?.email || ''; });
  });
})();
