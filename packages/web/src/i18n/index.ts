import type { Author } from '@deskssh/core';
import { FIRST_PARTY_AUTHOR } from '@/lib/author';
import { en, type MessageKey } from './en';
import { es } from './es';

export type Locale = 'en' | 'es';

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, es };

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'es'];
export const DEFAULT_LOCALE: Locale = 'en';

/** Display name and translator credit for each locale (shown in Settings). */
export interface LocaleInfo {
  readonly label: string;
  readonly translator: Author;
}

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  en: { label: 'English', translator: FIRST_PARTY_AUTHOR },
  es: { label: 'Español', translator: FIRST_PARTY_AUTHOR },
};

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

const LOCALE_KEY = 'deskssh.locale';

/** The user's chosen locale (persisted), else the best browser match. */
export function getStoredLocale(): Locale {
  try {
    const value = localStorage.getItem(LOCALE_KEY);
    if (value && SUPPORTED_LOCALES.includes(value as Locale)) return value as Locale;
  } catch {
    // localStorage may be blocked; fall through to browser detection.
  }
  return detectLocale();
}

/** Persist the user's locale choice (per-device, like the theme). */
export function setStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // Ignore persistence failures.
  }
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
