// js/i18n.js
// Expanded client-side language switcher with comprehensive translations (EN/FR).
(function(){
  const translations = {
    en: {
      // brand & nav
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
      // homepage
      'hero.tagline': 'Showcase skills. Unlock opportunities.',
      'hero.cta.primary': 'Join free',
      'hero.cta.secondary': 'Explore talent',
      // about / mission
      'about.title': 'Why Aganze exists',
      'mission.title': 'Our mission',
      // forms & buttons
      'button.publish': 'Publish evidence',
      'button.login': 'Log in',
      'button.signup': 'Join free',
      'button.send': 'Send message',
      // pages
      'page.join.eyebrow': 'JOIN AGANZE',
      'page.join.title': 'Build your profile and get discovered.',
      'page.login.title': 'Log in to your account.',
      'page.profile.title': 'Tell your story and show your work.',
      'page.upload.title': 'Showcase a simulation or project.',
      // privacy / legal
      'footer.copyright': '© 2026 Aganze NetworkTalent Platform',
      'privacy.title': 'Your information matters.'
    },
    fr: {
      // brand & nav
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
      // homepage
      'hero.tagline': 'Montrez vos compétences. Débloquez des opportunités.',
      'hero.cta.primary': 'S’inscrire',
      'hero.cta.secondary': 'Explorer',
      // about / mission
      'about.title': 'Pourquoi Aganze existe',
      'mission.title': 'Notre mission',
      // forms & buttons
      'button.publish': 'Publier la preuve',
      'button.login': 'Se connecter',
      'button.signup': 'S’inscrire',
      'button.send': 'Envoyer le message',
      // pages
      'page.join.eyebrow': 'REJOIGNEZ AGANZE',
      'page.join.title': 'Créez votre profil et faites-vous repérer.',
      'page.login.title': 'Connectez-vous à votre compte.',
      'page.profile.title': 'Racontez votre histoire et montrez votre travail.',
      'page.upload.title': 'Présentez une simulation ou un projet.',
      // privacy / legal
      'footer.copyright': '© 2026 Aganze Plateforme Talents',
      'privacy.title': 'Vos informations sont importantes.'
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
      if (text === undefined) return; // leave existing text if not found

      // For inputs/textareas use placeholder when data-i18n-placeholder present
      if (el.hasAttribute('data-i18n-placeholder')){
        el.placeholder = dict[el.getAttribute('data-i18n-placeholder')] || el.placeholder;
        return;
      }

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
