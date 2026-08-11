import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en/translation.json';
import ro from './locales/ro/translation.json';
import pl from './locales/pl/translation.json';
import cs from './locales/cs/translation.json';
import hu from './locales/hu/translation.json';
import de from './locales/de/translation.json';
import nl from './locales/nl/translation.json';
import fr from './locales/fr/translation.json';
import es from './locales/es/translation.json';

const resources = {
  en: { translation: en },
  ro: { translation: ro },
  pl: { translation: pl },
  cs: { translation: cs },
  hu: { translation: hu },
  de: { translation: de },
  nl: { translation: nl },
  fr: { translation: fr },
  es: { translation: es },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ro',
    interpolation: {
      escapeValue: false
    }
  });

// LanguageDetector's own default caches (localStorage/cookie) mean a
// returning visitor's — or anyone who's explicitly used the in-app
// switcher's — choice is respected automatically and this block never runs
// for them. First-time visitors with nothing cached get IP-geo instead of
// the detector's browser-language guess: RO in Romania, EN everywhere
// else. /api/geo reads Vercel's edge-injected country header, so this is a
// same-origin fetch with no external service/API key; it silently no-ops
// (leaving the detector's guess in place) in local dev, where there's no
// Vercel edge in front of the request to set that header.
if (typeof window !== 'undefined' && !localStorage.getItem('i18nextLng')) {
  fetch('/api/geo')
    .then(res => res.json())
    .then(({ country }: { country: string | null }) => {
      i18n.changeLanguage(country === 'RO' ? 'ro' : 'en');
    })
    .catch(() => { /* geo lookup unavailable — keep the detector's guess */ });
}

export default i18n;
