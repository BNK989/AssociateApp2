import { describe, expect, it } from 'vitest';
import { STREAK_BONUS_AT, STREAK_MULTIPLIER } from '@/lib/gameConfig';
import { calculateSolvePoints } from './dailyScoring';
import {
    MAX_STREAK_STEP,
    maxSolvePoints,
    solveFeedback,
    streakStepFor,
    tierAtLeast,
} from './feedbackTiers';

/** A solve of `word` at `hintLevel`, scored exactly as the game would score it. */
function graded(word: string, hintLevel: number, consecutive = 0) {
    const points = calculateSolvePoints(word, hintLevel, consecutive);
    return { points, feedback: solveFeedback({ word, points, consecutive: consecutive + 1 }) };
}

describe('streakStepFor', () => {
    it('is 0 until the score multiplier actually starts', () => {
        for (let n = 0; n < STREAK_BONUS_AT; n += 1) {
            expect(streakStepFor(n)).toBe(0);
        }
    });

    it('starts at 1 on the solve the bonus begins on', () => {
        expect(streakStepFor(STREAK_BONUS_AT)).toBe(1);
        expect(streakStepFor(STREAK_BONUS_AT + 1)).toBe(2);
    });

    // An unbounded climb ends up somewhere shrill, and the note ladder in
    // rewardNotes.ts is exactly MAX_STREAK_STEP + 1 long.
    it('stops climbing at the cap', () => {
        expect(streakStepFor(STREAK_BONUS_AT + MAX_STREAK_STEP + 50)).toBe(MAX_STREAK_STEP);
    });

    it('tolerates a nonsense streak rather than producing NaN', () => {
        expect(streakStepFor(Number.NaN)).toBe(0);
        expect(streakStepFor(-4)).toBe(0);
    });
});

describe('tierAtLeast', () => {
    it('orders the tiers', () => {
        expect(tierAtLeast('clean', 'solid')).toBe(true);
        expect(tierAtLeast('solid', 'solid')).toBe(true);
        expect(tierAtLeast('assisted', 'solid')).toBe(false);
    });
});

describe('solveFeedback', () => {
    it('grades an unaided solve as clean', () => {
        expect(graded('elephant', 0).feedback.tier).toBe('clean');
    });

    // The two cheap tiers cost 20% between them, which must not be enough to
    // demote a solve the player did most of the work on.
    it('keeps the first two hint tiers at solid', () => {
        expect(graded('elephant', 1).feedback.tier).toBe('solid');
        expect(graded('elephant', 2).feedback.tier).toBe('solid');
    });

    it('grades a solve that took the AI clue as assisted', () => {
        expect(graded('elephant', 3).feedback.tier).toBe('assisted');
    });

    /**
     * The reason the grade is a ratio and not the raw points. Both of these are
     * unaided solves and both must read as clean, even though one is worth
     * nearly twice the other.
     */
    it('does not reward a long word more than a short one', () => {
        const short = graded('cat', 0);
        const long = graded('encyclopaedia', 0);

        expect(long.points).toBeGreaterThan(short.points);
        expect(short.feedback.tier).toBe('clean');
        expect(long.feedback.tier).toBe('clean');
        expect(short.feedback.intensity).toBe(long.feedback.intensity);
    });

    // A streak multiplies the points, which pushes the ratio above 1. It must
    // not fall out of the top tier by overshooting it.
    it('keeps a streak-boosted solve clean', () => {
        const streaked = graded('elephant', 0, STREAK_BONUS_AT);

        expect(streaked.points).toBeGreaterThan(maxSolvePoints('elephant'));
        expect(streaked.feedback.tier).toBe('clean');
        expect(streaked.feedback.streakStep).toBeGreaterThan(0);
    });

    it('escalates intensity with the streak but never past 1', () => {
        const plain = solveFeedback({ word: 'elephant', points: 18, consecutive: 1 });
        const running = solveFeedback({ word: 'elephant', points: 27, consecutive: 99 });

        expect(running.intensity).toBeGreaterThan(plain.intensity);
        expect(running.intensity).toBeLessThanOrEqual(1);
    });

    // The free starting word is solved for 0 points. It must grade, not divide
    // by zero, and it must land on the quietest tier.
    it('survives a zero-point solve', () => {
        const feedback = solveFeedback({ word: 'anything', points: 0, consecutive: 0 });

        expect(feedback.tier).toBe('assisted');
        expect(Number.isFinite(feedback.intensity)).toBe(true);
    });

    it('survives an empty word', () => {
        const feedback = solveFeedback({ word: '', points: 0, consecutive: 0 });
        expect(Number.isFinite(feedback.intensity)).toBe(true);
    });

    it('agrees with the scoring module about what a clean solve is worth', () => {
        expect(maxSolvePoints('elephant')).toBe(calculateSolvePoints('elephant', 0, 0));
        expect(STREAK_MULTIPLIER).toBeGreaterThan(1);
    });
});
