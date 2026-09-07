import { describe, expect, it } from 'vitest';
import {
    DEFAULT_FEEDBACK_POLICY,
    parseFeedbackPolicy,
    resolveFeedbackPolicy,
    shouldBurst,
    unitScalar,
} from './feedbackPolicy';

describe('unitScalar', () => {
    it('clamps into 0-1', () => {
        expect(unitScalar(1.7, 0.5)).toBe(1);
        expect(unitScalar(-3, 0.5)).toBe(0);
        expect(unitScalar(0.4, 0.5)).toBe(0.4);
    });

    it('falls back rather than passing NaN into a gain node', () => {
        expect(unitScalar(Number.NaN, 0.5)).toBe(0.5);
        expect(unitScalar('loud', 0.5)).toBe(0.5);
        expect(unitScalar(undefined, 0.5)).toBe(0.5);
    });
});

describe('parseFeedbackPolicy', () => {
    it('treats anything that is not an object as the compiled defaults', () => {
        for (const value of [null, undefined, 'nope', 7, []]) {
            expect(parseFeedbackPolicy(value)).toEqual(DEFAULT_FEEDBACK_POLICY);
        }
    });

    // The seeded row is `{}` on purpose, so it cannot drift from gameConfig.ts.
    it('treats an empty object as the compiled defaults', () => {
        expect(parseFeedbackPolicy({})).toEqual(DEFAULT_FEEDBACK_POLICY);
    });

    it('reads a stored policy', () => {
        const policy = parseFeedbackPolicy({
            soundEnabled: false,
            volume: 0.25,
            streakPitch: false,
            missSound: false,
            burstFrom: 'clean',
            flourish: 0.5,
            haptics: false,
        });

        expect(policy.soundEnabled).toBe(false);
        expect(policy.volume).toBe(0.25);
        expect(policy.burstFrom).toBe('clean');
        expect(policy.flourish).toBe(0.5);
    });

    it('falls back per field rather than rejecting the whole blob', () => {
        const policy = parseFeedbackPolicy({ volume: 'loud', burstFrom: 'sometimes' });

        expect(policy.volume).toBe(DEFAULT_FEEDBACK_POLICY.volume);
        expect(policy.burstFrom).toBe(DEFAULT_FEEDBACK_POLICY.burstFrom);
        expect(policy.soundEnabled).toBe(DEFAULT_FEEDBACK_POLICY.soundEnabled);
    });

    it('clamps a stored volume that would deafen a player', () => {
        expect(parseFeedbackPolicy({ volume: 11 }).volume).toBe(1);
    });
});

describe('resolveFeedbackPolicy', () => {
    const loud = parseFeedbackPolicy({ soundEnabled: true, volume: 1 });

    // The asymmetry with the hint policy, and the reason there is no `force`
    // scope for this key: a game master must not be able to un-mute anybody.
    it('lets a muted player stay muted', () => {
        expect(resolveFeedbackPolicy(loud, { soundEnabled: false }).soundEnabled).toBe(false);
    });

    it('keeps sound off when the game master turned it off, whatever the player set', () => {
        const off = parseFeedbackPolicy({ soundEnabled: false });
        expect(resolveFeedbackPolicy(off, { soundEnabled: true }).soundEnabled).toBe(false);
    });

    it('treats a player who never touched the setting as wanting sound', () => {
        expect(resolveFeedbackPolicy(loud, {}).soundEnabled).toBe(true);
    });

    it('scales the game master ceiling by the player volume rather than replacing it', () => {
        const quiet = parseFeedbackPolicy({ volume: 0.5 });
        expect(resolveFeedbackPolicy(quiet, { volume: 0.5 }).volume).toBe(0.25);
    });

    it('ignores a nonsense player volume', () => {
        expect(resolveFeedbackPolicy(loud, { volume: Number.NaN }).volume).toBe(1);
    });

    it('leaves the visual half of the policy alone', () => {
        const resolved = resolveFeedbackPolicy(loud, { soundEnabled: false });
        expect(resolved.flourish).toBe(loud.flourish);
        expect(resolved.burstFrom).toBe(loud.burstFrom);
    });
});

describe('shouldBurst', () => {
    it('honours the threshold', () => {
        const policy = parseFeedbackPolicy({ burstFrom: 'solid' });

        expect(shouldBurst(policy, 'clean')).toBe(true);
        expect(shouldBurst(policy, 'solid')).toBe(true);
        expect(shouldBurst(policy, 'assisted')).toBe(false);
    });

    it('never bursts when the threshold is off', () => {
        const policy = parseFeedbackPolicy({ burstFrom: 'off' });
        expect(shouldBurst(policy, 'clean')).toBe(false);
    });

    // Flourish 0 is "calm everything down", so sparks have to go with it --
    // otherwise particles keep flying while the number sits still.
    it('never bursts at zero flourish', () => {
        const policy = parseFeedbackPolicy({ burstFrom: 'assisted', flourish: 0 });
        expect(shouldBurst(policy, 'clean')).toBe(false);
    });
});
