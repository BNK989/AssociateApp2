import { describe, expect, it, vi } from 'vitest';
import {
    settleArmed,
    settleCountdown,
    settlePressure,
    settlesDueBy,
} from './settleRules';
import { DEFAULT_SETTLE_POLICY, type SettlePolicy } from './settlePolicy';

/**
 * With the anagram switched on.
 *
 * `HINT_2_WITHHOLDS_POSITIONS` ships on — hint 2 gives letters without their
 * places, orange in the pool. It shipped off for one day (2026-09-13), painting
 * two thirds of the word green in place, and a suite inheriting the switch would
 * have gone quietly vacuous rather than fail. So these cases state the premise.
 * `positionalReveal.test.ts` reads the real value and covers both branches.
 */
vi.mock('@/lib/gameConfig', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/gameConfig')>();
    return { ...actual, HINT_2_WITHHOLDS_POSITIONS: true, maskWithholdsPositions: (level: number) => level >= 2 };
});


const policy = (over: Partial<SettlePolicy> = {}): SettlePolicy => ({
    ...DEFAULT_SETTLE_POLICY,
    ...over,
});

describe('settleArmed', () => {
    it('holds the rung back until the word is far enough up the ladder', () => {
        expect(settleArmed(0, policy())).toBe(false);
        expect(settleArmed(1, policy())).toBe(false);
        expect(settleArmed(2, policy())).toBe(true);
        expect(settleArmed(3, policy())).toBe(true);
    });

    it('is never armed when the mode is off', () => {
        expect(settleArmed(3, policy({ mode: 'off' }))).toBe(false);
    });
});

describe('settlePressure and settlesDueBy', () => {
    it('credits a wrong guess as dwell, like the stuck offer does', () => {
        const p = policy({ strikeCreditMs: 12_000 });
        expect(settlePressure({ msOnWord: 1_000, strikes: 2 }, p)).toBe(25_000);
    });

    it('owes nothing before the first delay', () => {
        const p = policy({ firstDelayMs: 20_000, intervalMs: 15_000 });
        expect(settlesDueBy(19_999, p)).toBe(0);
        expect(settlesDueBy(20_000, p)).toBe(1);
    });

    it('counts one more per interval after that', () => {
        const p = policy({ firstDelayMs: 20_000, intervalMs: 15_000 });
        expect(settlesDueBy(34_999, p)).toBe(1);
        expect(settlesDueBy(35_000, p)).toBe(2);
        expect(settlesDueBy(50_000, p)).toBe(3);
    });

    it('is derived from elapsed time, so a throttled tab converges rather than drifts', () => {
        // The property that matters: a tab backgrounded for five minutes owes
        // the same count as one that ticked the whole way through.
        const p = policy({ firstDelayMs: 20_000, intervalMs: 15_000 });
        expect(settlesDueBy(320_000, p)).toBe(21);
    });
});

describe('settleCountdown', () => {
    const p = policy({ firstDelayMs: 20_000, intervalMs: 10_000 });

    it('counts toward the first letter before it has landed', () => {
        expect(settleCountdown(5_000, p, false)).toEqual({
            msUntilNext: 15_000,
            progressPercent: 25,
        });
    });

    it('skips the first delay once the drip has started', () => {
        // In `offered` mode the player has already been given a letter, so the
        // wait they are watching is the interval, not the opening delay.
        expect(settleCountdown(0, p, true)).toEqual({
            msUntilNext: 10_000,
            progressPercent: 0,
        });
    });

    it('counts up, so a full ring means a letter is landing', () => {
        // The opposite direction from the auto-hint ring, which drains. That
        // clock takes points away; this one brings a letter.
        expect(settleCountdown(9_000, p, true).progressPercent).toBe(90);
    });

    it('restarts at every interval boundary', () => {
        expect(settleCountdown(10_000, p, true).progressPercent).toBe(0);
        expect(settleCountdown(15_000, p, true).progressPercent).toBe(50);
        expect(settleCountdown(20_000, p, true).progressPercent).toBe(0);
    });

    it('stays inside 0–100 whatever it is handed', () => {
        for (const ms of [-1, 0, 1e9, NaN]) {
            const { progressPercent } = settleCountdown(ms, p, true);
            expect(progressPercent).toBeGreaterThanOrEqual(0);
            expect(progressPercent).toBeLessThanOrEqual(100);
        }
    });
});
