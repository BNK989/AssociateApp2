/**
 * Script guard for runtime-translated daily-game content.
 *
 * The daily puzzle is authored in English and translated per locale by Gemini
 * (see `src/lib/dailyTranslation.ts`). The model is asked for a locale by ISO
 * code, and on `he` it intermittently emits Arabic words inside otherwise
 * Hebrew hints -- the two share a right-to-left neighbourhood in the model's
 * latent space and `gemini-flash-lite` drifts between them. A player reported
 * the hint "דיבור חרישי שנשמע بالكاد", where the last word is Arabic.
 *
 * Nothing used to check the script of what came back, and the result is cached
 * for 24h, so a single drifted generation was served to every Hebrew player for
 * the rest of the day. This module is the check: it classifies the characters
 * of a translated payload and reports, in words a human can relay, which
 * characters do not belong to the locale's writing system.
 *
 * Latin is tolerated in every locale (proper nouns, numerals, brand names). A
 * non-Latin locale must still read predominantly in its own script, which is
 * what catches a hint that came back entirely in English.
 */

import { defaultLocale, isSupportedLocale, type Locale } from '@/i18n/locales';

/** A writing system, named as the prompt and the logs refer to it. */
export type ScriptName =
    | 'Latin'
    | 'Hebrew'
    | 'Arabic'
    | 'Cyrillic'
    | 'Greek'
    | 'Devanagari'
    | 'Thai'
    | 'Armenian'
    | 'Georgian'
    | 'CJK';

/**
 * Character ranges per script. Deliberately explicit rather than
 * `\p{Script=...}`: `tsconfig` targets ES2017, where Unicode property escapes
 * are a syntax error.
 */
const SCRIPT_RANGES: Record<ScriptName, RegExp> = {
    Latin: /[A-Za-z\u00C0-\u024F]/,
    // Hebrew block + Hebrew presentation forms.
    Hebrew: /[\u0590-\u05FF\uFB1D-\uFB4F]/,
    // Arabic, Arabic Supplement, Extended-A, and both presentation-form blocks (stopping short of U+FEFF, the byte-order mark).
    Arabic: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFC]/,
    Cyrillic: /[\u0400-\u04FF]/,
    Greek: /[\u0370-\u03FF]/,
    Devanagari: /[\u0900-\u097F]/,
    Thai: /[\u0E00-\u0E7F]/,
    Armenian: /[\u0530-\u058F]/,
    Georgian: /[\u10A0-\u10FF]/,
    // Hiragana, Katakana, unified ideographs, Hangul syllables.
    CJK: /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/,
};

const SCRIPT_NAMES = Object.keys(SCRIPT_RANGES) as ScriptName[];

/** The writing system each shipped locale is written in. */
export const LOCALE_SCRIPT: Record<Locale, ScriptName> = {
    en: 'Latin',
    he: 'Hebrew',
    ar: 'Arabic',
    es: 'Latin',
    fr: 'Latin',
    de: 'Latin',
    ro: 'Latin',
};

/** English language names, for prompts and log lines. */
export const LOCALE_LANGUAGE: Record<Locale, string> = {
    en: 'English',
    he: 'Hebrew',
    ar: 'Arabic',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    ro: 'Romanian',
};

/**
 * The script a locale is most likely to be confused with, named explicitly in
 * the prompt. Hebrew and Arabic are the pair this guard exists for.
 */
export const LOCALE_CONFUSABLE_SCRIPT: Partial<Record<Locale, ScriptName>> = {
    he: 'Arabic',
    ar: 'Hebrew',
};

export function scriptFor(locale: string): ScriptName {
    return LOCALE_SCRIPT[isSupportedLocale(locale) ? locale : defaultLocale];
}

export function languageFor(locale: string): string {
    return LOCALE_LANGUAGE[isSupportedLocale(locale) ? locale : defaultLocale];
}

function classify(char: string): ScriptName | null {
    for (const name of SCRIPT_NAMES) {
        if (SCRIPT_RANGES[name].test(char)) return name;
    }
    return null;
}

export interface ScriptTally {
    /** Letters belonging to the locale's own script. */
    native: number;
    /** Letters in the Latin script, which every locale tolerates. */
    latin: number;
    /** Scripts present that belong to neither, with the characters seen. */
    foreign: Partial<Record<ScriptName, string>>;
}

/** Counts the letters of `text` by writing system, relative to `locale`. */
export function tallyScripts(text: string, locale: string): ScriptTally {
    const expected = scriptFor(locale);
    const tally: ScriptTally = { native: 0, latin: 0, foreign: {} };

    for (const char of text) {
        const script = classify(char);
        if (!script) continue;

        if (script === expected) {
            tally.native += 1;
        } else if (script === 'Latin') {
            tally.latin += 1;
        } else {
            const seen = tally.foreign[script] ?? '';
            if (!seen.includes(char)) tally.foreign[script] = seen + char;
        }
    }

    return tally;
}

/**
 * Why one string is not acceptable for `locale`, phrased for a log line, or
 * `null` when it is fine.
 *
 * Two failures are reported, in this order:
 * - characters from a script that is neither the locale's nor Latin;
 * - a non-Latin locale whose text carries no native letters, or fewer native
 *   letters than Latin ones, which means it came back in the wrong language.
 */
export function describeScriptViolation(text: string, locale: string, label: string): string | null {
    const trimmed = text.trim();
    if (!trimmed) return `${label} is empty`;

    const expected = scriptFor(locale);
    const tally = tallyScripts(trimmed, locale);

    const foreign = Object.entries(tally.foreign) as [ScriptName, string][];
    if (foreign.length > 0) {
        const detail = foreign.map(([script, chars]) => `${script} ("${chars}")`).join(', ');
        return `${label} mixes ${detail} into ${expected} text: "${trimmed}"`;
    }

    if (expected !== 'Latin' && tally.native === 0) {
        return `${label} contains no ${expected} letters: "${trimmed}"`;
    }

    if (expected !== 'Latin' && tally.latin > tally.native) {
        return `${label} is mostly Latin rather than ${expected}: "${trimmed}"`;
    }

    return null;
}

export interface TranslationPayload {
    theme: string;
    words: string[];
    hints: string[];
}

export interface ScriptCheckResult {
    ok: boolean;
    /** One line per offending field. Fed back to the model on the retry. */
    reasons: string[];
}

/**
 * Checks a whole translated payload. Also verifies the arrays line up with the
 * source chain, because a short `hints` array silently unhints the board.
 */
export function checkTranslationScript(
    payload: TranslationPayload,
    locale: string,
    expectedWordCount: number,
): ScriptCheckResult {
    const reasons: string[] = [];

    if (payload.words.length !== expectedWordCount) {
        reasons.push(`words has ${payload.words.length} entries, expected ${expectedWordCount}`);
    }
    if (payload.hints.length !== expectedWordCount) {
        reasons.push(`hints has ${payload.hints.length} entries, expected ${expectedWordCount}`);
    }

    const fields: [string, string][] = [
        ['theme', payload.theme],
        ...payload.words.map((word, i): [string, string] => [`words[${i}]`, word]),
        ...payload.hints.map((hint, i): [string, string] => [`hints[${i}]`, hint]),
    ];

    for (const [label, value] of fields) {
        if (typeof value !== 'string') {
            reasons.push(`${label} is not a string`);
            continue;
        }
        const violation = describeScriptViolation(value, locale, label);
        if (violation) reasons.push(violation);
    }

    return { ok: reasons.length === 0, reasons };
}
