/**
 * The single source of truth for which languages Associ8 ships.
 *
 * A locale belongs here only when `messages/<locale>.json` exists. The routing
 * config, the language picker, the daily-game translation pipeline and the
 * admin translations dashboard all derive from this list, so adding a language
 * is one edit here plus one new message file.
 *
 * Why it is centralised (CLAUDE.md §6): the list used to be duplicated in four
 * places and drifted. `routing.locales` declared 19 languages while only 7 had
 * translations, so a player on an Italian device was detected as `it`,
 * redirected to `/it`, and silently served English copy under `lang="it"`.
 */

/** Locales with a `messages/*.json` file. Order drives the language picker. */
export const locales = ['en', 'he', 'ar', 'es', 'fr', 'de', 'ro'] as const;

export type Locale = (typeof locales)[number];

/** Used when the browser asks for a language we do not ship. */
export const defaultLocale: Locale = 'en';

/** Right-to-left locales. Drives `<html dir>` and per-component `dir`. */
export const rtlLocales: readonly Locale[] = ['he', 'ar'];

/** Native-name labels for the language picker — never translated. */
export const localeLabels: Record<Locale, string> = {
    en: 'English',
    he: 'עברית',
    ar: 'العربية',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    ro: 'Română',
};

/** Type guard for untrusted locale strings (route params, headers, DB rows). */
export function isSupportedLocale(value: unknown): value is Locale {
    return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/** Text direction for a locale. Unknown values fall back to the default locale. */
export function getLocaleDirection(locale: unknown): 'rtl' | 'ltr' {
    if (!isSupportedLocale(locale)) return getLocaleDirection(defaultLocale);
    return rtlLocales.includes(locale) ? 'rtl' : 'ltr';
}
