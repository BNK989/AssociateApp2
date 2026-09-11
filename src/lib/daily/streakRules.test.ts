import { describe, expect, it } from 'vitest';
import {
    earnsStreakBonus,
    solvesUntilBonus,
    streakAfterSolve,
    streakAfterUnsolved,
    STREAK_BONUS_AT,
} from './streakRules';

describe('streakAfterSolve', () => {
    it('extends the run', () => {
        expect(streakAfterSolve(0)).toBe(1);
        expect(streakAfterSolve(4)).toBe(5);
    });
});

describe('streakAfterUnsolved', () => {
    it('costs one step rather than the whole run', () => {
        expect(streakAfterUnsolved(5)).toBe(4);
        expect(streakAfterUnsolved(1)).toBe(0);
    });

    it('never goes below zero', () => {
        expect(streakAfterUnsolved(0)).toBe(0);
    });

    // The point of the decay: a player who loses one word is still within
    // reach of the bonus, which is what makes the next word worth playing.
    it('leaves a player one solve from the bonus they were on', () => {
        expect(earnsStreakBonus(streakAfterUnsolved(STREAK_BONUS_AT))).toBe(false);
        expect(solvesUntilBonus(streakAfterUnsolved(STREAK_BONUS_AT))).toBe(1);
    });
});

describe('earnsStreakBonus', () => {
    it('switches on at the threshold and stays on', () => {
        expect(earnsStreakBonus(STREAK_BONUS_AT - 1)).toBe(false);
        expect(earnsStreakBonus(STREAK_BONUS_AT)).toBe(true);
        expect(earnsStreakBonus(STREAK_BONUS_AT + 4)).toBe(true);
    });
});

describe('solvesUntilBonus', () => {
    it('counts down to the bonus and stops at zero', () => {
        expect(solvesUntilBonus(0)).toBe(STREAK_BONUS_AT);
        expect(solvesUntilBonus(STREAK_BONUS_AT)).toBe(0);
        expect(solvesUntilBonus(STREAK_BONUS_AT + 2)).toBe(0);
    });
});
