import { describe, expect, it } from 'vitest';
import { SOLVE_TIERS } from '@/lib/daily/feedbackTiers';
import { burstVisual, solvedRingClass } from './solveBurstStyles';

const base = { intensity: 0.6, flourish: 1, streakStep: 0, withSparks: true };

describe('burstVisual', () => {
    it('gives better solves more sparks', () => {
        const assisted = burstVisual({ ...base, tier: 'assisted' });
        const solid = burstVisual({ ...base, tier: 'solid' });
        const clean = burstVisual({ ...base, tier: 'clean' });

        expect(assisted.sparkCount).toBeLessThan(solid.sparkCount);
        expect(solid.sparkCount).toBeLessThan(clean.sparkCount);
    });

    it('adds sparks as a streak runs', () => {
        const plain = burstVisual({ ...base, tier: 'clean', streakStep: 0 });
        const streaked = burstVisual({ ...base, tier: 'clean', streakStep: 4 });

        expect(streaked.sparkCount).toBeGreaterThan(plain.sparkCount);
    });

    // Past the cap it reads as noise and costs frames to animate.
    it('caps the spark count however long the streak', () => {
        const huge = burstVisual({ ...base, tier: 'clean', streakStep: 500 });
        expect(huge.sparkCount).toBeLessThanOrEqual(14);
    });

    it('emits nothing when the policy excludes this tier', () => {
        expect(burstVisual({ ...base, tier: 'clean', withSparks: false }).sparkCount).toBe(0);
    });

    it('scales sparks and travel down with the flourish setting', () => {
        const full = burstVisual({ ...base, tier: 'clean', flourish: 1 });
        const half = burstVisual({ ...base, tier: 'clean', flourish: 0.5 });

        expect(half.sparkCount).toBeLessThan(full.sparkCount);
        expect(half.rise).toBeLessThan(full.rise);
    });

    /**
     * The point of the floor: a game master turning celebration off should get
     * a calmer game, not one where scoring stops being visible. The number must
     * still be rendered at a readable size even at flourish 0.
     */
    it('still shows the number at zero flourish', () => {
        const off = burstVisual({ ...base, tier: 'clean', flourish: 0 });

        expect(off.sparkCount).toBe(0);
        expect(off.scale).toBe(1);
        expect(off.rise).toBeGreaterThan(0);
    });

    it('clamps a flourish outside 0-1', () => {
        const over = burstVisual({ ...base, tier: 'clean', flourish: 9 });
        const at = burstVisual({ ...base, tier: 'clean', flourish: 1 });

        expect(over).toEqual(at);
    });

    it('gives every tier its own look', () => {
        const classes = SOLVE_TIERS.map((tier) => burstVisual({ ...base, tier }).numberClass);
        expect(new Set(classes).size).toBe(SOLVE_TIERS.length);
    });
});

describe('solvedRingClass', () => {
    it('gives every tier its own ring', () => {
        const rings = SOLVE_TIERS.map(solvedRingClass);
        expect(new Set(rings).size).toBe(SOLVE_TIERS.length);
        expect(rings.every(Boolean)).toBe(true);
    });
});
