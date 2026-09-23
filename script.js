(() => {
  'use strict';

  const STORAGE_KEY = 'aganze-demo-user';
  const SIMULATIONS_KEY = 'aganze-simulations';

  const ready = (callback) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback);
    else callback();
  };

  const getJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  };

  const setJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const notify = (message, type = 'success') => {
    let alert = document.querySelector('.site-alert');
    if (!alert) {
      alert = document.createElement('div');
      alert.className = 'site-alert';
      alert.setAttribute('role', 'status');
      document.body.appendChild(alert);
    }
    alert.textContent = message;
    alert.dataset.type = type;
    alert.classList.add('is-visible');
    window.clearTimeout(alert.hideTimer);
    alert.hideTimer = window.setTimeout(() => alert.classList.remove('is-visible'), 4200);
  };

  const addUtilityStyles = () => {
    if (document.getElementById('aganze-interaction-styles')) return;
    const style = document.createElement('style');
    style.id = 'aganze-interaction-styles';
    style.textContent = `
      .site-alert{position:fixed;right:20px;bottom:20px;z-index:20;max-width:360px;padding:14px 18px;border-radius:10px;background:#123c35;color:#fff;box-shadow:0 12px 30px #123c3540;transform:translateY(20px);opacity:0;pointer-events:none;transition:.25s ease;font-weight:600}.site-alert.is-visible{transform:none;opacity:1}.site-alert[data-type=error]{background:#9b4438}.is-invalid{border-color:#c65345!important;outline:2px solid #c6534522}.file-name{display:block;margin-top:8px;color:#667572;font-size:.85rem}.filter-empty{grid-column:1/-1;text-align:center;padding:35px;background:#fff;border:1px solid #dfe6df;border-radius:12px;color:#667572}
    `;
    document.head.appendChild(style);
  };

  const initMenu = () => {
    const button = document.querySelector('.menu-toggle');
    const nav = document.querySelector('nav');
    if (!button || !nav) return;
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
    }));
  };

  const initForms = () => {
    document.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', event => {
        event.preventDefault();
        const fields = [...form.querySelectorAll('input, select, textarea')];
        let valid = true;
        fields.forEach(field => {
          const required = field.required;
          const bad = required && !field.value.trim();
          field.classList.toggle('is-invalid', bad);
          if (bad) valid = false;
        });
        const password = form.querySelector('input[type="password"]');
        const confirmation = form.querySelector('input[name*="confirm" i], input[id*="confirm" i]');
        if (password && password.value.length < 8) {
          password.classList.add('is-invalid');
          notify('Use a password with at least 8 characters.', 'error');
          return;
        }
        if (confirmation && password && confirmation.value !== password.value) {
          confirmation.classList.add('is-invalid');
          notify('Passwords do not match.', 'error');
          return;
        }
        if (!valid) { notify('Please complete the required fields.', 'error'); return; }

        const data = Object.fromEntries(new FormData(form).entries());
        if (/signup|register|create/i.test(`${form.action} ${form.className} ${form.id} ${document.title}`)) {
          setJson(STORAGE_KEY, { name: data.name || data.fullname || data.email?.split('@')[0] || 'Aganze member', email: data.email || '' });
        }
        if (form.querySelector('input[type="file"]')) {
          const simulations = getJson(SIMULATIONS_KEY, []);
          simulations.push({ title: data.title || data.name || 'New simulation', created: new Date().toISOString() });
          setJson(SIMULATIONS_KEY, simulations);
        }
        const destination = form.dataset.successUrl;
        notify(form.dataset.successMessage || 'Thanks — your information was submitted successfully.');
        if (destination) window.setTimeout(() => { window.location.href = destination; }, 700);
        else form.reset();
      });
      form.querySelectorAll('input, select, textarea').forEach(field => field.addEventListener('input', () => field.classList.remove('is-invalid')));
    });
  };

  const initFileInputs = () => {
    document.querySelectorAll('input[type="file"]').forEach(input => {
      input.addEventListener('change', () => {
        const label = input.parentElement?.querySelector('.file-name') || document.createElement('small');
        label.className = 'file-name';
        label.textContent = input.files.length ? `${input.files.length} file${input.files.length > 1 ? 's' : ''} selected` : 'No file selected';
        if (!label.parentElement) input.parentElement?.appendChild(label);
      });
    });
  };

  const initTalentFilters = () => {
    const input = document.querySelector('.filters input');
    const select = document.querySelector('.filters select');
    const cards = [...document.querySelectorAll('.talent-card')];
    if (!cards.length || (!input && !select)) return;
    const filter = () => {
      const query = (input?.value || '').toLowerCase().trim();
      const category = (select?.value || '').toLowerCase();
      let visible = 0;
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        const matchesQuery = !query || text.includes(query);
        const matchesCategory = !category || category === 'all' || text.includes(category);
        card.hidden = !(matchesQuery && matchesCategory);
        if (!card.hidden) visible++;
      });
      let empty = document.querySelector('.filter-empty');
      if (!visible) {
        if (!empty) { empty = document.createElement('p'); empty.className = 'filter-empty'; document.querySelector('.talent-grid')?.appendChild(empty); }
        empty.textContent = 'No talent profiles match your search. Try another skill or category.';
      } else if (empty) empty.remove();
    };
    input?.addEventListener('input', filter);
    select?.addEventListener('change', filter);
  };

  ready(() => {
    addUtilityStyles();
    initMenu();
    initForms();
    initFileInputs();
    initTalentFilters();
  });
})();
