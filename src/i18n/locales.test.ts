import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import {
    defaultLocale,
    getLocaleDirection,
    isSupportedLocale,
    localeLabels,
    locales,
    rtlLocales,
} from './locales';
import { routing } from './routing';

const messagesDir = path.resolve(__dirname, '../../messages');

describe('supported locales', () => {
    it('ships a messages file for every declared locale', () => {
        const missing = locales.filter(
            (locale) => !fs.existsSync(path.join(messagesDir, `${locale}.json`)),
        );
        expect(missing, 'locales declared with no messages/<locale>.json').toEqual([]);
    });

    it('declares every messages file as a locale', () => {
        const onDisk = fs
            .readdirSync(messagesDir)
            .filter((file) => file.endsWith('.json'))
            .map((file) => file.replace(/\.json$/, ''));
        const undeclared = onDisk.filter((locale) => !isSupportedLocale(locale));
        expect(undeclared, 'messages files with no entry in locales.ts').toEqual([]);
    });

    it('includes the default locale', () => {
        expect(locales).toContain(defaultLocale);
    });

    it('has no duplicates', () => {
        expect(new Set(locales).size).toBe(locales.length);
    });

    it('labels every locale', () => {
        expect(Object.keys(localeLabels).sort()).toEqual([...locales].sort());
    });

    it('only marks declared locales as RTL', () => {
        rtlLocales.forEach((locale) => expect(locales).toContain(locale));
    });
});

describe('isSupportedLocale', () => {
    it('accepts shipped locales', () => {
        expect(isSupportedLocale('he')).toBe(true);
        expect(isSupportedLocale('en')).toBe(true);
    });

    it('rejects languages we do not translate', () => {
        // These were routable before the locale list was trimmed and served
        // English copy under a foreign `lang` attribute.
        ['it', 'pt', 'ja', 'zh', 'ru', 'hi', 'tr', 'nl', 'pl', 'sv', 'vi', 'th'].forEach(
            (locale) => expect(isSupportedLocale(locale)).toBe(false),
        );
    });

    it('rejects non-string and malformed values', () => {
        expect(isSupportedLocale(undefined)).toBe(false);
        expect(isSupportedLocale(null)).toBe(false);
        expect(isSupportedLocale(42)).toBe(false);
        expect(isSupportedLocale('EN')).toBe(false);
        expect(isSupportedLocale('en-US')).toBe(false);
    });
});

describe('getLocaleDirection', () => {
    it('returns rtl for Hebrew and Arabic', () => {
        expect(getLocaleDirection('he')).toBe('rtl');
        expect(getLocaleDirection('ar')).toBe('rtl');
    });

    it('returns ltr for the Latin-script locales', () => {
        (['en', 'es', 'fr', 'de', 'ro'] as const).forEach((locale) =>
            expect(getLocaleDirection(locale)).toBe('ltr'),
        );
    });

    it('falls back to the default locale direction for unknown values', () => {
        expect(getLocaleDirection('it')).toBe('ltr');
        expect(getLocaleDirection(undefined)).toBe('ltr');
    });
});

describe('routing config', () => {
    it('routes exactly the locales we translate', () => {
        expect([...routing.locales]).toEqual([...locales]);
    });

    it('defaults to the default locale', () => {
        expect(routing.defaultLocale).toBe(defaultLocale);
    });

    it('detects the visitor device language', () => {
        // A first-time visitor with no NEXT_LOCALE cookie is routed by their
        // Accept-Language header. Turning this off would land every new player
        // in English regardless of device.
        expect(routing.localeDetection).toBe(true);
    });

    it('omits the prefix for the default locale only', () => {
        expect(routing.localePrefix).toBe('as-needed');
    });
});
