import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { calculateMessageValue, HINT_COSTS } from '@/lib/gameLogic';
import {
    calculateSolvePoints,
    getNextHintLevel,
    MAX_HINT_LEVEL,
    needsScrambleVisuals,
    STREAK_BONUS_AT,
    STREAK_MULTIPLIER,
} from './dailyScoring';

const WORD = 'Harmony';

describe('calculateSolvePoints', () => {
    it('awards the full word value with no hints and no streak', () => {
        expect(calculateSolvePoints(WORD, 0, 0)).toBe(calculateMessageValue(WORD));
    });

    it('deducts hint tiers cumulatively', () => {
        const base = calculateMessageValue(WORD);

        expect(calculateSolvePoints(WORD, 1, 0)).toBe(Math.floor(base * (1 - HINT_COSTS.TIER_1)));
        expect(calculateSolvePoints(WORD, 2, 0)).toBe(
            Math.floor(base * (1 - HINT_COSTS.TIER_1 - HINT_COSTS.TIER_2)),
        );
        expect(calculateSolvePoints(WORD, 3, 0)).toBe(
            Math.floor(base * (1 - HINT_COSTS.TIER_1 - HINT_COSTS.TIER_2 - HINT_COSTS.TIER_3)),
        );
    });

    it('leaves something on the table even with every hint taken', () => {
        expect(calculateSolvePoints(WORD, 3, 0)).toBeGreaterThan(0);
    });

    it('applies the streak multiplier at the threshold, not before', () => {
        const plain = calculateSolvePoints(WORD, 0, STREAK_BONUS_AT - 1);
        const bonused = calculateSolvePoints(WORD, 0, STREAK_BONUS_AT);

        expect(plain).toBe(calculateMessageValue(WORD));
        expect(bonused).toBe(Math.floor(calculateMessageValue(WORD) * STREAK_MULTIPLIER));
    });

    it('combines hint deductions with the streak bonus', () => {
        const base = calculateMessageValue(WORD);
        expect(calculateSolvePoints(WORD, 1, 5)).toBe(
            Math.floor(base * (1 - HINT_COSTS.TIER_1) * STREAK_MULTIPLIER),
        );
    });

    it('always returns a whole number', () => {
        expect(Number.isInteger(calculateSolvePoints(WORD, 2, 4))).toBe(true);
    });
});

describe('getNextHintLevel', () => {
    // These tests set revealType explicitly; the app default is 'ALL', which
    // short-circuits the ladder entirely.
    const ladder = { revealType: 'STEP' };

    it('steps up one level at a time', () => {
        expect(getNextHintLevel({ currentLevel: 0, word: WORD, guesses: [], ...ladder })).toBe(1);
        expect(getNextHintLevel({ currentLevel: 1, word: WORD, guesses: [], ...ladder })).toBe(2);
    });

    it('skips level 1 when the first letter is already exposed', () => {
        // Level 1 reveals the first letter; buying it would tell them nothing.
        expect(getNextHintLevel({ currentLevel: 0, word: WORD, guesses: ['hxxx'], ...ladder })).toBe(2);
    });

    it('does not skip when guesses miss the first letter', () => {
        expect(getNextHintLevel({ currentLevel: 0, word: WORD, guesses: ['zzz'], ...ladder })).toBe(1);
    });

    it('skips the scramble when the word is already mostly revealed', () => {
        // Guessing every letter pushes the revealed percentage past the threshold.
        const guesses = [...new Set(WORD.toLowerCase().split(''))];
        expect(getNextHintLevel({ currentLevel: 1, word: WORD, guesses, ...ladder })).toBe(MAX_HINT_LEVEL);
    });

    it('never exceeds the maximum level', () => {
        expect(getNextHintLevel({ currentLevel: 3, word: WORD, guesses: [], ...ladder })).toBe(3);
    });

    it('jumps straight to the AI clue under the ALL reveal type', () => {
        for (const currentLevel of [0, 1, 2]) {
            expect(getNextHintLevel({ currentLevel, word: WORD, guesses: [], revealType: 'ALL' }))
                .toBe(MAX_HINT_LEVEL);
        }
    });

    it('uses the configured reveal type by default', () => {
        const result = getNextHintLevel({ currentLevel: 0, word: WORD, guesses: [] });
        const expected = GAME_CONFIG.DEFAULT_AUTO_HINT_REVEAL_TYPE === 'ALL' ? MAX_HINT_LEVEL : 1;
        expect(result).toBe(expected);
    });

    it('handles an empty word without throwing', () => {
        expect(() => getNextHintLevel({ currentLevel: 0, word: '', guesses: [], ...ladder })).not.toThrow();
    });
});

describe('needsScrambleVisuals', () => {
    it('is true when jumping to the AI clue from below the scramble', () => {
        expect(needsScrambleVisuals(0, 3)).toBe(true);
        expect(needsScrambleVisuals(1, 3)).toBe(true);
    });

    it('is false when the scramble is already in place', () => {
        expect(needsScrambleVisuals(2, 3)).toBe(false);
    });

    it('is false for ordinary level steps', () => {
        expect(needsScrambleVisuals(0, 1)).toBe(false);
        expect(needsScrambleVisuals(1, 2)).toBe(false);
    });
});
