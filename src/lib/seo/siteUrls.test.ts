import { describe, it, expect } from 'vitest';
import { locales, defaultLocale } from '@/i18n/locales';
import {
    PUBLIC_PAGES,
    SITE_ORIGIN,
    buildSitemapEntries,
    languageAlternates,
    localePath,
    localizedUrl,
} from './siteUrls';

describe('localePath', () => {
    it('leaves the default locale unprefixed, matching localePrefix: as-needed', () => {
        expect(localePath('en', '/daily')).toBe('/daily');
    });

    it('prefixes every other locale', () => {
        expect(localePath('he', '/daily')).toBe('/he/daily');
        expect(localePath('ro', '/privacy')).toBe('/ro/privacy');
    });

    it('does not leave a trailing slash on the default landing page', () => {
        expect(localePath('en', '')).toBe('');
        expect(localePath('en', '/')).toBe('');
    });

    it('gives a translated landing page the bare prefix', () => {
        expect(localePath('ar', '')).toBe('/ar');
        expect(localePath('ar', '/')).toBe('/ar');
    });
});

describe('localizedUrl', () => {
    it('builds an absolute URL with no double slash at the root', () => {
        expect(localizedUrl('en', '')).toBe(SITE_ORIGIN);
        expect(localizedUrl('fr', '')).toBe(`${SITE_ORIGIN}/fr`);
        expect(localizedUrl('fr', '/daily')).toBe(`${SITE_ORIGIN}/fr/daily`);
    });

    it('accepts an origin override so a preview deploy can be mapped too', () => {
        expect(localizedUrl('he', '/daily', 'https://staging.example.com'))
            .toBe('https://staging.example.com/he/daily');
    });
});

describe('languageAlternates', () => {
    it('names every shipped locale plus x-default', () => {
        const alternates = languageAlternates('/daily');
        for (const locale of locales) {
            expect(alternates[locale]).toBe(localizedUrl(locale, '/daily'));
        }
        expect(Object.keys(alternates)).toHaveLength(locales.length + 1);
    });

    it('points x-default at the default locale, not at a prefixed copy', () => {
        expect(languageAlternates('/daily')['x-default']).toBe(`${SITE_ORIGIN}/daily`);
    });
});

describe('buildSitemapEntries', () => {
    const lastModified = new Date('2026-09-15T00:00:00.000Z');
    const entries = buildSitemapEntries(lastModified);

    it('emits one row per page per locale', () => {
        expect(entries).toHaveLength(PUBLIC_PAGES.length * locales.length);
    });

    it('lists the daily game, which is the page with new content every day', () => {
        const daily = entries.find((entry) => entry.url === `${SITE_ORIGIN}/daily`);
        expect(daily).toBeDefined();
        expect(daily?.changeFrequency).toBe('daily');
    });

    it('never advertises a prefixed default locale, which would 404 on a redirect loop', () => {
        expect(entries.some((entry) => entry.url.startsWith(`${SITE_ORIGIN}/${defaultLocale}`))).toBe(false);
    });

    it('does not advertise /login, which this app does not route', () => {
        expect(entries.some((entry) => entry.url.includes('/login'))).toBe(false);
    });

    it('keeps private surfaces out of the index', () => {
        for (const path of ['/settings', '/admin', '/thank-you']) {
            expect(entries.some((entry) => entry.url.includes(path))).toBe(false);
        }
    });

    it('carries the full alternate set on every row, including translated ones', () => {
        const hebrewDaily = entries.find((entry) => entry.url === `${SITE_ORIGIN}/he/daily`);
        expect(hebrewDaily?.alternates.languages.en).toBe(`${SITE_ORIGIN}/daily`);
        expect(hebrewDaily?.alternates.languages.he).toBe(`${SITE_ORIGIN}/he/daily`);
    });

    it('ranks the canonical locale above its translations', () => {
        const english = entries.find((entry) => entry.url === SITE_ORIGIN);
        const spanish = entries.find((entry) => entry.url === `${SITE_ORIGIN}/es`);
        expect(english?.priority).toBe(1);
        expect(spanish?.priority).toBeLessThan(1);
    });

    it('stamps every row with the date it was handed', () => {
        expect(entries.every((entry) => entry.lastModified === lastModified)).toBe(true);
    });
});
