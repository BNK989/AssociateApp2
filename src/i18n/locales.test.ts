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

/** Every leaf key in a messages tree, as dotted paths. */
function keyPaths(node: unknown, prefix = ''): string[] {
    if (typeof node !== 'object' || node === null) return [prefix];

    return Object.entries(node as Record<string, unknown>)
        .flatMap(([key, value]) => keyPaths(value, prefix ? `${prefix}.${key}` : key));
}

function load(locale: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(messagesDir, `${locale}.json`), 'utf8'));
}

describe('message parity', () => {
    // CLAUDE.md 6: an English key has to land in all seven files. Catching a
    // missing one here is the difference between a test failure and a player
    // seeing a raw key like `GameRoom.Stuck.letter_title` on screen.
    const english = keyPaths(load('en')).sort();

    for (const locale of locales.filter((l) => l !== 'en')) {
        it(`${locale} carries exactly the keys en does`, () => {
            const theirs = keyPaths(load(locale)).sort();

            expect(english.filter((k) => !theirs.includes(k)), `missing from ${locale}`).toEqual([]);
            expect(theirs.filter((k) => !english.includes(k)), `only in ${locale}`).toEqual([]);
        });
    }
});

describe('end screen labels', () => {
    // These two head adjacent sections of the daily summary -- the result
    // squares and the words themselves. They shipped identical, so the screen
    // showed the same heading twice with different content under each, which
    // reads as a rendering bug rather than as two sections.
    for (const locale of locales) {
        it(`${locale} distinguishes the grid from the chain`, () => {
            const messages = load(locale) as {
                GameRoom: { DailyEndGame: Record<string, string> };
            };
            const { grid_label: grid, chain_label: chain } = messages.GameRoom.DailyEndGame;

            expect(grid).toBeTruthy();
            expect(chain).toBeTruthy();
            expect(grid).not.toBe(chain);
        });
    }
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
