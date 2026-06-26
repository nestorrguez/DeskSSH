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

export type MessageParams = Record<string, string | number>;

/** Translate a key, replacing `{name}` placeholders. Falls back to English. */
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const template = catalogs[locale][key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  );
}

/** A bound translator `t(key, params?)` for a fixed locale, convenient in components. */
export type Translator = (key: MessageKey, params?: MessageParams) => string;

export function makeTranslator(locale: Locale): Translator {
  return (key, params) => translate(locale, key, params);
}

export type { MessageKey };
