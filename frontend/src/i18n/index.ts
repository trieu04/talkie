import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import vi from './locales/vi.json';

const STORAGE_KEY = 'talkie-language';
const SUPPORTED_LANGUAGES = ['vi', 'en'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const isSupportedLanguage = (language: string): language is SupportedLanguage =>
  SUPPORTED_LANGUAGES.includes(language as SupportedLanguage);

const detectLanguage = (): SupportedLanguage => {
  const storedLanguage = localStorage.getItem(STORAGE_KEY);
  if (storedLanguage && isSupportedLanguage(storedLanguage)) {
    return storedLanguage;
  }

  const browserLanguage = navigator.language.toLowerCase().split('-')[0] ?? 'vi';
  return isSupportedLanguage(browserLanguage) ? browserLanguage : 'vi';
};

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    vi: { translation: vi },
  },
  lng: detectLanguage(),
  fallbackLng: 'vi',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

void i18n.on('languageChanged', (language) => {
  if (isSupportedLanguage(language)) {
    localStorage.setItem(STORAGE_KEY, language);
  }
});

export default i18n;
