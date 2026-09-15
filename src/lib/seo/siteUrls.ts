/**
 * Every public URL the site wants a search engine to know about.
 *
 * Kept separate from `src/app/sitemap.ts` because a Next route file cannot be
 * unit-tested: it is a default export the framework calls at build time. The
 * rules that actually go wrong — which locale gets a prefix, what an alternate
 * link looks like, which pages are public at all — live here where a test can
 * reach them.
 *
 * Two rules drive everything below:
 *
 *   1. `localePrefix: 'as-needed'` (see `src/i18n/routing.ts`) means the default
 *      locale is served unprefixed. `/daily` and `/en/daily` are not both real;
 *      only the first is, so only the first may appear in the sitemap.
 *   2. The same page in seven languages is seven URLs of one document, not seven
 *      documents. Without `hreflang` alternates a crawler reads them as thin
 *      duplicates and picks one, which is how six translations disappear.
 */

import { defaultLocale, locales, type Locale } from '@/i18n/locales';

/** Production origin. No trailing slash — every path below supplies its own. */
export const SITE_ORIGIN = 'https://associ8game.com';

/**
 * The pages a stranger may land on.
 *
 * Deliberately short. `/settings`, `/admin` and `/thank-you` are reachable only
 * with intent or a session and have nothing to offer a search result, so they
 * are omitted here and disallowed in `robots.ts`.
 */
export type PublicPage = {
    /** Root-relative and locale-free: `''` is the landing page. */
    path: string;
    changeFrequency: 'daily' | 'monthly' | 'yearly';
    priority: number;
};

/**
 * `/daily` is the product: new content every day, one URL, the page any link
 * from a shared grid lands on. It carried priority 0 before this list existed —
 * it was not in the sitemap at all, while `/login`, which is not a route in this
 * app, was.
 */
export const PUBLIC_PAGES: readonly PublicPage[] = [
    { path: '', changeFrequency: 'daily', priority: 1 },
    { path: '/daily', changeFrequency: 'daily', priority: 0.9 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
];

/**
 * A path as that locale actually serves it.
 *
 * The default locale keeps the bare path; every other locale gets its prefix.
 * Returns `''` for the default locale's landing page, so callers can join it to
 * an origin without producing a trailing slash.
 */
export function localePath(locale: Locale, path: string): string {
    const normalized = path === '/' ? '' : path;
    return locale === defaultLocale ? normalized : `/${locale}${normalized}`;
}

/** The absolute URL a given locale serves a page at. */
export function localizedUrl(locale: Locale, path: string, origin: string = SITE_ORIGIN): string {
    return `${origin}${localePath(locale, path)}`;
}

/**
 * The `hreflang` map for one page, in the shape Next's Metadata API wants.
 *
 * `x-default` names the URL to send a visitor whose language we do not ship;
 * omitting it leaves that choice to the crawler's guess.
 */
export function languageAlternates(path: string, origin: string = SITE_ORIGIN): Record<string, string> {
    const alternates: Record<string, string> = {};
    for (const locale of locales) {
        alternates[locale] = localizedUrl(locale, path, origin);
    }
    alternates['x-default'] = localizedUrl(defaultLocale, path, origin);
    return alternates;
}

/** One sitemap row, structurally identical to Next's `MetadataRoute.Sitemap` entry. */
export type SitemapEntry = {
    url: string;
    lastModified: Date;
    changeFrequency: PublicPage['changeFrequency'];
    priority: number;
    alternates: { languages: Record<string, string> };
};

/**
 * Every public page in every locale, each row carrying the full alternate set.
 *
 * One row per locale rather than one row per page: a crawler has to be able to
 * discover `/he/daily` as a URL in its own right, and the alternates on it then
 * tell it what the other six are.
 */
export function buildSitemapEntries(lastModified: Date, origin: string = SITE_ORIGIN): SitemapEntry[] {
    return PUBLIC_PAGES.flatMap((page) => {
        const languages = languageAlternates(page.path, origin);
        return locales.map((locale) => ({
            url: localizedUrl(locale, page.path, origin),
            lastModified,
            changeFrequency: page.changeFrequency,
            // A translation is not a lesser page, but the default locale is the
            // canonical one, so it keeps the full weight and the rest step down.
            priority: locale === defaultLocale ? page.priority : Number((page.priority * 0.8).toFixed(2)),
            alternates: { languages },
        }));
    });
}

/**
 * Open Graph asks for `language_TERRITORY`; the app only ever tracks language.
 * Picking one territory per language is a guess, but a named region is what the
 * crawlers parse — `he` alone is silently dropped.
 */
export const ogLocales: Record<Locale, string> = {
    en: 'en_US',
    he: 'he_IL',
    ar: 'ar_AR',
    es: 'es_ES',
    fr: 'fr_FR',
    de: 'de_DE',
    ro: 'ro_RO',
};

/**
 * The `alternates` block for one page in one locale.
 *
 * Must be set per page rather than once in the layout: metadata is inherited,
 * so a canonical declared on the layout would tell a crawler that `/he/daily`
 * is really `/he`, and the daily game — the page the whole funnel points at —
 * would be dropped from the index in six languages.
 */
export function pageAlternates(locale: Locale, path: string, origin: string = SITE_ORIGIN) {
    return {
        canonical: localizedUrl(locale, path, origin),
        languages: languageAlternates(path, origin),
    };
}
