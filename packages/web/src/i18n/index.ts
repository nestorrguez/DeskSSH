import { en, type MessageKey } from './en';
import { es } from './es';

export type Locale = 'en' | 'es';

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, es };

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'es'];
export const DEFAULT_LOCALE: Locale = 'en';

/** Pick the best supported locale from the browser, falling back to English. */
export function detectLocale(
  preferred: readonly string[] = typeof navigator !== 'undefined' ? navigator.languages : [],
): Locale {
  for (const lang of preferred) {
    const base = lang.toLowerCase().split('-')[0];
    if (base && SUPPORTED_LOCALES.includes(base as Locale)) return base as Locale;
  }
  return DEFAULT_LOCALE;
}

/** Translate a key for a locale. Missing translations fall back to English. */
export function translate(locale: Locale, key: MessageKey): string {
  return catalogs[locale][key] ?? en[key];
}

/** A bound translator `t(key)` for a fixed locale, convenient in components. */
export type Translator = (key: MessageKey) => string;

export function makeTranslator(locale: Locale): Translator {
  return (key) => translate(locale, key);
}

export type { MessageKey };
