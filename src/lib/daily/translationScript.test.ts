import { describe, expect, it } from 'vitest';
import {
    checkTranslationScript,
    describeScriptViolation,
    languageFor,
    scriptFor,
    tallyScripts,
} from './translationScript';

/** The hint a player reported: Hebrew with one Arabic word ("barely") in it. */
const DRIFTED_HEBREW_HINT = 'דיבור חרישי שנשמע بالكاد';

describe('scriptFor / languageFor', () => {
    it('maps every shipped locale to its writing system', () => {
        expect(scriptFor('he')).toBe('Hebrew');
        expect(scriptFor('ar')).toBe('Arabic');
        expect(scriptFor('ro')).toBe('Latin');
    });

    it('falls back to the default locale for anything unshipped', () => {
        expect(scriptFor('it')).toBe('Latin');
        expect(languageFor('it')).toBe('English');
    });
});

describe('tallyScripts', () => {
    it('separates native letters, tolerated Latin, and foreign scripts', () => {
        const tally = tallyScripts(DRIFTED_HEBREW_HINT, 'he');
        expect(tally.native).toBeGreaterThan(0);
        expect(tally.latin).toBe(0);
        expect(tally.foreign.Arabic).toBe('بالكد');
    });

    it('ignores punctuation, digits and whitespace', () => {
        const tally = tallyScripts('שלום, 42! ...', 'he');
        expect(tally.native).toBe(4);
        expect(tally.latin).toBe(0);
        expect(Object.keys(tally.foreign)).toHaveLength(0);
    });

    it('does not read a byte-order mark as Arabic', () => {
        const tally = tallyScripts('﻿שלום', 'he');
        expect(Object.keys(tally.foreign)).toHaveLength(0);
    });
});

describe('describeScriptViolation', () => {
    it('accepts a clean Hebrew hint', () => {
        expect(describeScriptViolation('דיבור חרישי שבקושי נשמע', 'he', 'hints[3]')).toBeNull();
    });

    it('names the Arabic characters that leaked into a Hebrew hint', () => {
        const violation = describeScriptViolation(DRIFTED_HEBREW_HINT, 'he', 'hints[3]');
        expect(violation).toContain('hints[3]');
        expect(violation).toContain('Arabic');
        // The log line has to carry the text itself so the human can relay it.
        expect(violation).toContain(DRIFTED_HEBREW_HINT);
    });

    it('rejects Hebrew leaking into Arabic, the same drift in reverse', () => {
        expect(describeScriptViolation('كلام هادئ שנשמע', 'ar', 'hints[0]')).toContain('Hebrew');
    });

    it('rejects a hint that came back in English for a Hebrew game', () => {
        expect(describeScriptViolation('Quiet speech, barely heard', 'he', 'hints[3]')).toContain('no Hebrew letters');
    });

    it('rejects a hint that is mostly Latin with a token of Hebrew', () => {
        expect(describeScriptViolation('Barely audible speech is רחש', 'he', 'hints[3]')).toContain('mostly Latin');
    });

    it('tolerates a proper noun inside an otherwise Hebrew hint', () => {
        expect(describeScriptViolation('חברת המחשבים Apple שינתה הכל', 'he', 'words[2]')).toBeNull();
    });

    it('accepts accented Latin for Latin-script locales', () => {
        expect(describeScriptViolation('Une boisson chaude à préparer', 'fr', 'hints[1]')).toBeNull();
    });

    it('rejects a non-Latin script inside a Latin-script locale', () => {
        expect(describeScriptViolation('Une boisson שנשמע', 'fr', 'hints[1]')).toContain('Hebrew');
    });

    it('rejects an empty string', () => {
        expect(describeScriptViolation('   ', 'he', 'theme')).toBe('theme is empty');
    });
});

describe('checkTranslationScript', () => {
    const clean = {
        theme: 'קולות הלילה',
        words: ['לחישה', 'רחש', 'שקט'],
        hints: ['מילים בקול נמוך מאוד', 'צליל עדין ברקע', 'היעדר כל צליל'],
    };

    it('accepts a fully Hebrew payload of the right length', () => {
        expect(checkTranslationScript(clean, 'he', 3)).toEqual({ ok: true, reasons: [] });
    });

    it('rejects the payload and names the field when one hint drifts to Arabic', () => {
        const drifted = { ...clean, hints: [clean.hints[0], DRIFTED_HEBREW_HINT, clean.hints[2]] };
        const result = checkTranslationScript(drifted, 'he', 3);

        expect(result.ok).toBe(false);
        expect(result.reasons).toHaveLength(1);
        expect(result.reasons[0]).toContain('hints[1]');
        expect(result.reasons[0]).toContain('Arabic');
    });

    it('catches a chain that came back the wrong length', () => {
        const short = { ...clean, hints: clean.hints.slice(0, 2) };
        const result = checkTranslationScript(short, 'he', 3);

        expect(result.ok).toBe(false);
        expect(result.reasons[0]).toBe('hints has 2 entries, expected 3');
    });

    it('reports every offending field, so one retry can fix them all', () => {
        const bad = {
            theme: 'Sounds of the night',
            words: ['لهمس', 'רחש', 'שקט'],
            hints: clean.hints,
        };
        const result = checkTranslationScript(bad, 'he', 3);

        expect(result.ok).toBe(false);
        expect(result.reasons).toHaveLength(2);
        expect(result.reasons[0]).toContain('theme');
        expect(result.reasons[1]).toContain('words[0]');
    });
});
