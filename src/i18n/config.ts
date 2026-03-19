export const locales = ['fr', 'ar', 'en', 'es'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'fr';

export const localeNames: Record<Locale, string> = {
  fr: 'Français',
  ar: 'العربية',
  en: 'English',
  es: 'Español',
};

export const isRTL = (locale: Locale): boolean => locale === 'ar';
