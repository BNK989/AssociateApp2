import { describe, it, expect } from 'vitest';
import { GAME_CONFIG, SETTLE } from '@/lib/gameConfig';
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
            Math.floor(base * (1 - HINT_COSTS.TIER_1 - HINT_COSTS.TIER_2 - HINT_COSTS.TIER_3 - SETTLE.CLUE_COST)),
        );
    });

    describe('the written clue', () => {
        const base = calculateMessageValue(WORD);
        const tiers = HINT_COSTS.TIER_1 + HINT_COSTS.TIER_2 + HINT_COSTS.TIER_3;

        it('costs its own share once the word reaches the clue, by any route', () => {
            expect(calculateSolvePoints(WORD, 3, 0, { clueCost: 0.2 })).toBe(
                Math.floor(base * (1 - tiers - 0.2)),
            );
        });

        it('costs nothing below the clue', () => {
            expect(calculateSolvePoints(WORD, 2, 0, { clueCost: 0.2 })).toBe(
                Math.floor(base * (1 - HINT_COSTS.TIER_1 - HINT_COSTS.TIER_2)),
            );
        });

        it('falls back to the compiled price when the policy does not supply one', () => {
            expect(calculateSolvePoints(WORD, 3, 0)).toBe(
                calculateSolvePoints(WORD, 3, 0, { clueCost: SETTLE.CLUE_COST }),
            );
        });

        it('is free when the word opened at the clue and the policy does not charge', () => {
            expect(calculateSolvePoints(WORD, 3, 0, {
                startLevel: 3, chargeForStartLevel: false, clueCost: 0.2,
            })).toBe(base);
        });
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

    describe('settled letters', () => {
        it('charges for each letter the drip walked into place', () => {
            const base = calculateMessageValue(WORD);

            expect(calculateSolvePoints(WORD, 0, 0, { settled: 2, settleCostPerLetter: 0.05 }))
                .toBe(Math.floor(base * (1 - 0.1)));
        });

        it('charges nothing when no letter settled, so nothing changes for anyone else', () => {
            expect(calculateSolvePoints(WORD, 2, 0, { settled: 0 }))
                .toBe(calculateSolvePoints(WORD, 2, 0));
        });

        it('stacks on top of the hint tiers rather than replacing them', () => {
            const withHints = calculateSolvePoints(WORD, 2, 0);
            const withBoth = calculateSolvePoints(WORD, 2, 0, { settled: 1 });

            expect(withBoth).toBeLessThan(withHints);
        });

        /**
         * The floor is the rung's whole economic argument. A settled solve has
         * to stay strictly better than the reveal it replaced, which scores
         * zero — otherwise the mechanic built to stop players giving up would,
         * at the far end of its own cost curve, make giving up the better move.
         */
        it('never lets a solve fall to nothing, however much was settled', () => {
            const ruinous = calculateSolvePoints(WORD, MAX_HINT_LEVEL, 0, {
                settled: 20,
                settleCostPerLetter: 0.5,
            });

            expect(ruinous).toBeGreaterThan(0);
            expect(ruinous).toBe(
                Math.floor(calculateMessageValue(WORD) * SETTLE.MIN_SCORE_FRACTION),
            );
        });

        it('beats revealing the word in the worst case the drip can reach', () => {
            // Every hint taken, the allowance spent, the costliest setting.
            const worst = calculateSolvePoints(WORD, MAX_HINT_LEVEL, 0, {
                settled: 4,
                settleCostPerLetter: 0.2,
            });

            // A revealed word scores zero and costs a streak step.
            expect(worst).toBeGreaterThan(0);
        });

        it('ignores a negative count rather than paying the player for it', () => {
            expect(calculateSolvePoints(WORD, 0, 0, { settled: -5 }))
                .toBe(calculateMessageValue(WORD));
        });

        it('falls back to the compiled cost when the policy does not supply one', () => {
            const base = calculateMessageValue(WORD);

            expect(calculateSolvePoints(WORD, 0, 0, { settled: 1 }))
                .toBe(Math.floor(base * (1 - SETTLE.COST_PER_LETTER)));
        });
    });
});

describe('getNextHintLevel', () => {
    // The ladder is now the app default; these still set it explicitly so the
    // cases stay readable next to the 'jump' one below.
    const ladder = { progression: 'ladder' as const };

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
            expect(getNextHintLevel({ currentLevel, word: WORD, guesses: [], progression: 'jump' }))
                .toBe(MAX_HINT_LEVEL);
        }
    });

    it('climbs one step at a time by default, rather than handing over the answer', () => {
        // The default used to jump, so the very first hint -- automatic or
        // from the button -- jumped to the AI clue and cost 60% of the word.
        expect(getNextHintLevel({ currentLevel: 0, word: WORD, guesses: [] })).toBe(1);
        expect(getNextHintLevel({ currentLevel: 1, word: WORD, guesses: [] })).toBe(2);
        expect(getNextHintLevel({ currentLevel: 2, word: WORD, guesses: [] })).toBe(MAX_HINT_LEVEL);
    });

    it('leaves the player time to think before the first automatic nudge', () => {
        expect(GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION).toBeGreaterThanOrEqual(15);
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
