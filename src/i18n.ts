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

export default i18n;
