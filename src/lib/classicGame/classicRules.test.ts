import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { calculateMessageValue, HINT_COSTS } from '@/lib/gameLogic';
import {
    ACCURACY_PENALTY,
    canActOnTarget,
    findTargetMessage,
    getHintDeduction,
    getRemainingSeconds,
    getSolveValue,
    getStreakMultiplier,
    validateOutgoingMessage,
} from './classicRules';

const ME = 'user-me';
const AUTHOR = 'user-author';

const msg = (id: string, over: { is_solved?: boolean; strikes?: number } = {}) => ({
    id,
    is_solved: false,
    strikes: 0,
    ...over,
});

describe('findTargetMessage', () => {
    it('returns the last word still in play', () => {
        expect(findTargetMessage([msg('a'), msg('b'), msg('c', { is_solved: true })])?.id).toBe('b');
    });

    it('skips words retired on strikes', () => {
        expect(findTargetMessage([msg('a'), msg('b', { strikes: 3 })])?.id).toBe('a');
    });

    it('returns undefined once nothing is left', () => {
        expect(findTargetMessage([msg('a', { is_solved: true })])).toBeUndefined();
        expect(findTargetMessage([])).toBeUndefined();
    });

    it('treats a missing strike count as zero', () => {
        expect(findTargetMessage([{ is_solved: false }])).toBeDefined();
    });
});

describe('canActOnTarget', () => {
    const base = { authorId: AUTHOR, currentUserId: ME, solvingTimeLeft: 10, authorHasLeft: false };

    it('lets the author act on their own word', () => {
        expect(canActOnTarget({ ...base, authorId: ME })).toBe(true);
    });

    it('blocks everyone else while the window is open', () => {
        expect(canActOnTarget(base)).toBe(false);
    });

    it('opens up once the window has expired', () => {
        expect(canActOnTarget({ ...base, solvingTimeLeft: 0 })).toBe(true);
    });

    it('opens up when the author has left, so the word stays clearable', () => {
        expect(canActOnTarget({ ...base, authorHasLeft: true })).toBe(true);
    });

    it('keeps the word locked while the countdown is merely unknown', () => {
        // null means "not started", which is not the same as expired.
        expect(canActOnTarget({ ...base, solvingTimeLeft: null })).toBe(false);
    });
});

describe('getStreakMultiplier', () => {
    it('escalates across the streak tiers', () => {
        expect(getStreakMultiplier(1)).toBe(1);
        expect(getStreakMultiplier(2)).toBe(1.2);
        expect(getStreakMultiplier(3)).toBe(1.5);
        expect(getStreakMultiplier(4)).toBe(2);
        expect(getStreakMultiplier(10)).toBe(2);
    });

    it('doubles again during fever', () => {
        expect(getStreakMultiplier(1, 3)).toBe(2);
        expect(getStreakMultiplier(4, 3)).toBe(4);
    });

    it('ignores fever once it has run out', () => {
        expect(getStreakMultiplier(3, 0)).toBe(1.5);
    });
});

describe('getHintDeduction', () => {
    it('charges nothing with no hints taken', () => {
        expect(getHintDeduction(0)).toBe(0);
    });

    it('accumulates each tier', () => {
        expect(getHintDeduction(1)).toBeCloseTo(HINT_COSTS.TIER_1);
        expect(getHintDeduction(2)).toBeCloseTo(HINT_COSTS.TIER_1 + HINT_COSTS.TIER_2);
        expect(getHintDeduction(3)).toBeCloseTo(HINT_COSTS.TIER_1 + HINT_COSTS.TIER_2 + HINT_COSTS.TIER_3);
    });

    it('uses TIER_2 for the second tier rather than repeating TIER_1', () => {
        // The original summed TIER_1 twice at level 3. It happened to give the
        // right number only because both tiers are 0.10 today; this pins the
        // intent so changing TIER_2 cannot silently break level-3 scoring.
        const expected = HINT_COSTS.TIER_1 + HINT_COSTS.TIER_2 + HINT_COSTS.TIER_3;
        expect(getHintDeduction(3)).toBeCloseTo(expected);
        expect(getHintDeduction(3) - getHintDeduction(2)).toBeCloseTo(HINT_COSTS.TIER_3);
        expect(getHintDeduction(2) - getHintDeduction(1)).toBeCloseTo(HINT_COSTS.TIER_2);
    });

    it('never exceeds the full value of the word', () => {
        expect(getHintDeduction(3)).toBeLessThan(1);
    });
});

describe('getSolveValue', () => {
    const WORD = 'Harmony';
    const base = calculateMessageValue(WORD);

    it('awards the full value for an exact answer with no hints', () => {
        expect(getSolveValue(WORD, 0, 1.0)).toBe(base);
    });

    it('takes a penalty for a fuzzy answer', () => {
        expect(getSolveValue(WORD, 0, 0.9)).toBe(Math.floor(base * (1 - ACCURACY_PENALTY)));
    });

    it('stacks the fuzzy penalty on top of hint deductions', () => {
        const expected = Math.floor(base * (1 - HINT_COSTS.TIER_1 - ACCURACY_PENALTY));
        expect(getSolveValue(WORD, 1, 0.9)).toBe(expected);
    });

    it('still pays something for a fuzzy answer with every hint taken', () => {
        expect(getSolveValue(WORD, 3, 0.85)).toBeGreaterThan(0);
    });

    it('returns a whole number', () => {
        expect(Number.isInteger(getSolveValue(WORD, 2, 0.95))).toBe(true);
    });
});

describe('validateOutgoingMessage', () => {
    const base = { existingContents: ['Coffee'], isMyTurn: true, isFirstWord: false };

    it('accepts a valid word', () => {
        expect(validateOutgoingMessage({ ...base, input: 'Morning' })).toBeNull();
    });

    it('rejects blank input', () => {
        expect(validateOutgoingMessage({ ...base, input: '   ' })).toBe('empty');
    });

    it('rejects an off-turn word', () => {
        expect(validateOutgoingMessage({ ...base, input: 'Morning', isMyTurn: false })).toBe('not-your-turn');
    });

    it('lets anyone send the very first word', () => {
        expect(validateOutgoingMessage({
            ...base, input: 'Morning', isMyTurn: false, isFirstWord: true,
        })).toBeNull();
    });

    it('rejects too many words', () => {
        const tooMany = Array(GAME_CONFIG.MESSAGE_WORD_LIMIT_MAX + 1).fill('a').join(' ');
        expect(validateOutgoingMessage({ ...base, input: tooMany })).toBe('word-count');
    });

    it('rejects an over-long word', () => {
        const tooLong = 'a'.repeat(GAME_CONFIG.MESSAGE_MAX_LENGTH + 1);
        expect(validateOutgoingMessage({ ...base, input: tooLong })).toBe('too-long');
    });

    it('rejects a duplicate regardless of case or padding', () => {
        expect(validateOutgoingMessage({ ...base, input: '  coffee ' })).toBe('duplicate');
        expect(validateOutgoingMessage({ ...base, input: 'COFFEE' })).toBe('duplicate');
    });

    it('checks the turn before anything else', () => {
        // An off-turn player gets told whose turn it is, not that their word was long.
        const tooLong = 'a'.repeat(GAME_CONFIG.MESSAGE_MAX_LENGTH + 1);
        expect(validateOutgoingMessage({ ...base, input: tooLong, isMyTurn: false })).toBe('not-your-turn');
    });
});

describe('getRemainingSeconds', () => {
    const NOW = Date.parse('2026-08-22T12:00:00.000Z');
    const ago = (ms: number) => new Date(NOW - ms).toISOString();

    it('rounds up to whole seconds', () => {
        expect(getRemainingSeconds(ago(1200), 10_000, NOW)).toBe(9);
    });

    it('reports zero once elapsed', () => {
        expect(getRemainingSeconds(ago(10_000), 10_000, NOW)).toBe(0);
        expect(getRemainingSeconds(ago(50_000), 10_000, NOW)).toBe(0);
    });

    it('never returns a negative', () => {
        expect(getRemainingSeconds(ago(999_999), 10_000, NOW)).toBe(0);
    });

    it('treats a missing start time as expired', () => {
        expect(getRemainingSeconds(null, 10_000, NOW)).toBe(0);
        expect(getRemainingSeconds(undefined, 10_000, NOW)).toBe(0);
    });

    it('reports the full duration at the moment it starts', () => {
        expect(getRemainingSeconds(ago(0), 10_000, NOW)).toBe(10);
    });
});
