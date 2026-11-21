import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager, Platform } from 'react-native';
import { en } from './en';
import { he } from './he';

export const RTL_LANGUAGES = ['he', 'ar'] as const;
export const isRtlLanguage = (lang: string): boolean => (RTL_LANGUAGES as readonly string[]).includes(lang);

const supported = ['en', 'he'];
export const detectLanguage = (): string => {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return supported.includes(code) ? code : 'en';
};

const language = detectLanguage();

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, he: { translation: he } },
  lng: language,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

// Web flips layout through the document direction. Native needs I18nManager and applies on the next app start.
export const applyDirection = (lang: string): void => {
  const rtl = isRtlLanguage(lang);
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    }
    return;
  }
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl);
};

applyDirection(language);

export const isRtl = (): boolean => isRtlLanguage(i18n.language);
/** Arrow that points along the reading direction. */
export const arrow = (): string => (isRtl() ? '←' : '→');

export default i18n;
