// js/i18n.js
// Simple client-side language switcher. Adds a FR/EN toggle and translates elements with `data-i18n`.
(function(){
  const translations = {
    en: {
      'brand-text': 'Aganze NetworkTalent Platform',
      'nav.about': 'About',
      'nav.explore': 'Explore talent',
      'nav.login': 'Log in',
      'nav.signup': 'Join free',
      'nav.dashboard': 'Dashboard',
      'nav.upload': 'Upload work',
      'nav.profile': 'Profile',
      'nav.contact': 'Contact',
      'nav.logout': 'Log out',
      'eyebrow.join': 'JOIN AGANZE',
      'hero.title.join': 'Build your profile and get discovered.',
      'hero.welcome.title': 'Log in to your account.',
      'hero.profile.title': 'Tell your story and show your work.',
      'footer.copyright': '© 2026 Aganze NetworkTalent Platform',
      'button.publish': 'Publish evidence',
      'button.login': 'Log in',
      'button.signup': 'Join free'
    },
    fr: {
      'brand-text': 'Aganze Plateforme Talents',
      'nav.about': 'À propos',
      'nav.explore': 'Explorer les talents',
      'nav.login': 'Connexion',
      'nav.signup': 'S’inscrire',
      'nav.dashboard': 'Tableau de bord',
      'nav.upload': 'Téléverser',
      'nav.profile': 'Profil',
      'nav.contact': 'Contact',
      'nav.logout': 'Déconnexion',
      'eyebrow.join': 'REJOIGNEZ AGANZE',
      'hero.title.join': 'Créez votre profil et faites-vous repérer.',
      'hero.welcome.title': 'Connectez-vous à votre compte.',
      'hero.profile.title': 'Racontez votre histoire et montrez votre travail.',
      'footer.copyright': '© 2026 Aganze Plateforme Talents',
      'button.publish': 'Publier la preuve',
      'button.login': 'Se connecter',
      'button.signup': 'S’inscrire'
    }
  };

  function getSavedLang(){
    return localStorage.getItem('aganze_lang') || (new URLSearchParams(location.search).get('lang')) || 'en';
  }

  function saveLang(lang){
    localStorage.setItem('aganze_lang', lang);
  }

  function applyTranslations(lang){
    document.documentElement.lang = (lang === 'fr') ? 'fr' : 'en';
    const dict = translations[lang] || translations.en;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = dict[key];
      if (!text) return;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (el.placeholder) el.placeholder = text;
      } else if (el.tagName === 'BUTTON' || el.tagName === 'A') {
        el.textContent = text;
      } else {
        el.textContent = text;
      }
    });

    // update language toggle label
    const toggle = document.getElementById('lang-toggle');
    if (toggle) toggle.textContent = (lang === 'fr') ? 'EN' : 'FR';
  }

  function toggleLang(){
    const current = getSavedLang();
    const next = current === 'fr' ? 'en' : 'fr';
    saveLang(next);
    applyTranslations(next);
  }

  // init on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    const lang = getSavedLang();
    applyTranslations(lang);

    // attach toggle behavior
    const toggle = document.getElementById('lang-toggle');
    if (toggle) toggle.addEventListener('click', () => {
      toggleLang();
    });
  });
})();
