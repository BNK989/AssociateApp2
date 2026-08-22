/**
 * Decides whether a generated chain is fit to be a day's puzzle.
 *
 * The generator asks a language model for a chain and the model is agreeable
 * rather than reliable: it will happily return yesterday's theme, repeat a word
 * inside its own chain, or write a hint containing the answer. Rather than
 * trusting the prompt to prevent all that, the result is checked here and
 * rejected if it fails.
 *
 * Every failure is phrased as an instruction, because the rejection reasons are
 * fed straight back to the model on the retry. A reason like "the theme is too
 * close to a recent one" is worth more than a boolean.
 */

import type { DayPlan } from './themeWheel';

/** Chain length may miss the weekday target by this much before it is rejected. */
const LENGTH_TOLERANCE = 1;

/** How far the mean connection strength may sit outside the weekday band. */
const CONNECTION_TOLERANCE = 0.08;

/** Words this short or long do not work on the board. */
const MIN_WORD_CHARS = 2;
const MAX_WORD_CHARS = 20;

/** A chain entry may be a short phrase, but not a sentence. */
const MAX_TOKENS_PER_WORD = 2;

/** Hints must describe, never point at a position in the list. */
const META_PHRASES = [
    'next word',
    'following word',
    'previous word',
    'word before',
    'word after',
    'the word below',
    'the word above',
    'first word',
    'last word',
];

const THEME_STOPWORDS = new Set(['the', 'of', 'and', 'a', 'an', 'in', 'on', 'to', 'for', '&']);

export type GeneratedChain = {
    theme: string;
    words: string[];
    hints?: string[];
    connection_scores?: number[];
};

export type ChainHistory = {
    /** Themes used recently; a new theme must not echo these. */
    recentThemes: string[];
    /** Every word used recently, so puzzles do not recycle vocabulary. */
    recentWords: string[];
};

export type ValidationResult = { ok: true } | { ok: false; reasons: string[] };

function normalizeWord(word: string): string {
    return word.trim().toLowerCase().replace(/\s+/g, ' ');
}

function themeTokens(theme: string): Set<string> {
    return new Set(
        theme
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((t) => t.length > 2 && !THEME_STOPWORDS.has(t)),
    );
}

/**
 * Whether two themes are close enough that a player would feel repetition.
 *
 * Compared on significant tokens rather than as strings, because "Symphony of
 * Sound" and "A Symphony of Sounds" are the same puzzle wearing a hat.
 */
export function themesAreTooSimilar(a: string, b: string): boolean {
    const left = themeTokens(a);
    const right = themeTokens(b);
    if (left.size === 0 || right.size === 0) return false;

    let shared = 0;
    for (const token of left) {
        if (right.has(token)) shared++;
    }

    return shared / Math.min(left.size, right.size) >= 0.5;
}

function checkShape(chain: GeneratedChain, plan: DayPlan, reasons: string[]): void {
    const { words } = chain;

    if (!Array.isArray(words) || words.length === 0) {
        reasons.push('the chain has no words');
        return;
    }

    if (Math.abs(words.length - plan.words) > LENGTH_TOLERANCE) {
        reasons.push(`the chain must be ${plan.words} words long, but ${words.length} were returned`);
    }

    for (const word of words) {
        const trimmed = word.trim();

        if (trimmed.length < MIN_WORD_CHARS || trimmed.length > MAX_WORD_CHARS) {
            reasons.push(`"${word}" is the wrong length for a board word`);
        }
        if (trimmed.split(/\s+/).length > MAX_TOKENS_PER_WORD) {
            reasons.push(`"${word}" is a phrase; use one or two words per link`);
        }
    }

    const seen = new Set<string>();
    for (const word of words) {
        const key = normalizeWord(word);
        if (seen.has(key)) {
            reasons.push(`"${word}" appears twice in the chain; every link must be distinct`);
        }
        seen.add(key);
    }
}

function checkHistory(chain: GeneratedChain, history: ChainHistory, reasons: string[]): void {
    for (const theme of history.recentThemes) {
        if (themesAreTooSimilar(chain.theme, theme)) {
            reasons.push(`the theme "${chain.theme}" is too close to the recent theme "${theme}"; choose a different subject`);
            break;
        }
    }

    const recent = new Set(history.recentWords.map(normalizeWord));
    const reused = chain.words.filter((w) => recent.has(normalizeWord(w)));

    if (reused.length > 0) {
        reasons.push(`these words were used in a recent puzzle and must not appear again: ${reused.join(', ')}`);
    }
}

const WORD_CHAR = /[a-z0-9]/;

/**
 * Whether a hint gives its own answer away.
 *
 * Checked on word boundaries rather than by substring, so a hint for "Bag" is
 * not condemned for the word "baggage" -- and built without a constructed
 * regex, which would need the answer escaped before it could be trusted.
 */
function containsWholeWord(haystack: string, needle: string): boolean {
    const text = haystack.toLowerCase();
    const target = needle.toLowerCase();
    if (target.length === 0) return false;

    let from = 0;
    for (;;) {
        const at = text.indexOf(target, from);
        if (at === -1) return false;

        const before = at === 0 ? ' ' : text[at - 1];
        const afterIndex = at + target.length;
        const after = afterIndex >= text.length ? ' ' : text[afterIndex];

        if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after)) return true;
        from = at + 1;
    }
}

function checkHints(chain: GeneratedChain, reasons: string[]): void {
    const { hints, words } = chain;
    if (!hints) return;

    if (hints.length !== words.length) {
        reasons.push(`there must be exactly one hint per word (${words.length}), but ${hints.length} were returned`);
        return;
    }

    hints.forEach((hint, index) => {
        const lower = hint.toLowerCase();

        for (const phrase of META_PHRASES) {
            if (lower.includes(phrase)) {
                reasons.push(`the hint for "${words[index]}" refers to the list itself ("${phrase}"); describe the idea instead`);
                break;
            }
        }

        const word = words[index]?.trim();
        if (word && containsWholeWord(hint, word)) {
            reasons.push(`the hint for "${word}" contains the answer`);
        }
    });
}

function checkConnections(chain: GeneratedChain, plan: DayPlan, reasons: string[]): void {
    const scores = chain.connection_scores;
    if (!scores) return;

    if (scores.length !== chain.words.length) {
        reasons.push('there must be one connection score per word');
        return;
    }

    if (scores.some((s) => typeof s !== 'number' || !Number.isFinite(s) || s < 0.1 || s > 1)) {
        reasons.push('every connection score must be a number between 0.1 and 1.0');
        return;
    }

    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    if (mean < plan.minConnection - CONNECTION_TOLERANCE) {
        reasons.push(`the links are too loose for this day; aim for an average connection strength near ${plan.minConnection}`);
    }
    if (mean > plan.maxConnection + CONNECTION_TOLERANCE) {
        reasons.push(`the links are too obvious for this day; aim for an average connection strength near ${plan.maxConnection}`);
    }
}

/**
 * Runs every check, collecting reasons rather than stopping at the first.
 *
 * One round-trip that reports four problems is cheaper than four round-trips
 * that report one each, and the model corrects better with the whole list.
 */
export function validateChain(
    chain: GeneratedChain,
    plan: DayPlan,
    history: ChainHistory,
): ValidationResult {
    const reasons: string[] = [];

    if (typeof chain.theme !== 'string' || chain.theme.trim().length === 0) {
        reasons.push('the theme is missing');
    }

    checkShape(chain, plan, reasons);

    if (Array.isArray(chain.words) && chain.words.length > 0) {
        checkHistory(chain, history, reasons);
        checkHints(chain, reasons);
        checkConnections(chain, plan, reasons);
    }

    return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}
