import { describe, expect, it } from 'vitest';
import { MAX_STREAK_STEP, SOLVE_TIERS } from '@/lib/daily/feedbackTiers';
import {
    frequencyOf,
    missVoicing,
    ROOT_HZ,
    solveVoicing,
    STREAK_LADDER,
    streakTranspose,
} from './rewardNotes';

describe('frequencyOf', () => {
    it('puts the root at the root', () => {
        expect(frequencyOf(0)).toBe(ROOT_HZ);
    });

    it('doubles at the octave', () => {
        expect(frequencyOf(12)).toBeCloseTo(ROOT_HZ * 2, 5);
        expect(frequencyOf(-12)).toBeCloseTo(ROOT_HZ / 2, 5);
    });

    it('gives a fifth its equal-tempered ratio', () => {
        expect(frequencyOf(7) / ROOT_HZ).toBeCloseTo(1.4983, 3);
    });
});

describe('streakTranspose', () => {
    it('is silent about streaks that have not started', () => {
        expect(streakTranspose(0)).toBe(0);
        expect(streakTranspose(-2)).toBe(0);
        expect(streakTranspose(Number.NaN)).toBe(0);
    });

    it('climbs the ladder one rung per step', () => {
        expect(streakTranspose(1)).toBe(STREAK_LADDER[1]);
        expect(streakTranspose(3)).toBe(STREAK_LADDER[3]);
    });

    // The cap is what stops the chime walking off the top of the keyboard.
    it('stops at the top rung', () => {
        expect(streakTranspose(MAX_STREAK_STEP)).toBe(STREAK_LADDER[MAX_STREAK_STEP]);
        expect(streakTranspose(500)).toBe(STREAK_LADDER[MAX_STREAK_STEP]);
    });

    it('has a ladder long enough for every step the grader can produce', () => {
        expect(STREAK_LADDER).toHaveLength(MAX_STREAK_STEP + 1);
    });
});

describe('solveVoicing', () => {
    it('gives every tier at least one tone', () => {
        for (const tier of SOLVE_TIERS) {
            expect(solveVoicing(tier, 0, true).length).toBeGreaterThan(0);
        }
    });

    // The shape carries the message, not the volume: a player should be able to
    // tell the tiers apart with the volume turned right down.
    it('gives better solves more notes', () => {
        expect(solveVoicing('assisted', 0, true).length)
            .toBeLessThan(solveVoicing('solid', 0, true).length);
        expect(solveVoicing('solid', 0, true).length)
            .toBeLessThan(solveVoicing('clean', 0, true).length);
    });

    it('transposes the whole voicing on a streak', () => {
        const plain = solveVoicing('clean', 0, true);
        const streaked = solveVoicing('clean', 2, true);

        streaked.forEach((tone, i) => {
            expect(tone.semitones).toBe(plain[i].semitones + streakTranspose(2));
        });
    });

    it('leaves the pitch alone when the game master turned streak pitch off', () => {
        expect(solveVoicing('clean', 4, false)).toEqual(solveVoicing('clean', 0, false));
    });

    it('does not mutate the shared voicing tables between calls', () => {
        solveVoicing('clean', MAX_STREAK_STEP, true);
        expect(solveVoicing('clean', 0, true)[0].semitones).toBe(0);
    });

    it('keeps every tone inside a sane gain and duration', () => {
        for (const tier of SOLVE_TIERS) {
            for (const tone of solveVoicing(tier, MAX_STREAK_STEP, true)) {
                expect(tone.gain).toBeGreaterThan(0);
                expect(tone.gain).toBeLessThanOrEqual(1);
                expect(tone.duration).toBeGreaterThan(0);
                expect(tone.duration).toBeLessThan(1);
                expect(frequencyOf(tone.semitones)).toBeLessThan(4000);
            }
        }
    });
});

describe('missVoicing', () => {
    it('falls rather than rises, so it cannot be mistaken for a reward', () => {
        const [tone] = missVoicing();
        expect(tone.glideTo).toBeDefined();
        expect(tone.glideTo!).toBeLessThan(tone.semitones);
    });

    it('sits below the root and stays quieter than any solve', () => {
        const [miss] = missVoicing();
        const quietestSolve = Math.min(...solveVoicing('assisted', 0, true).map((t) => t.gain));

        expect(miss.semitones).toBeLessThan(0);
        expect(miss.gain).toBeLessThan(quietestSolve);
    });

    it('is over before the shake is', () => {
        expect(missVoicing()[0].duration).toBeLessThan(0.5);
    });
});
