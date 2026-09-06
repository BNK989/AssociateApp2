import { describe, expect, it } from 'vitest';
import { nextProgressCue, type CueArgs } from './progressCues';

const args = (over: Partial<CueArgs> = {}): CueArgs => ({
    outcome: 'solved',
    remaining: 5,
    total: 8,
    consecutive: 1,
    completed: false,
    ...over,
});

describe('nextProgressCue', () => {
    it('stays quiet once the chain is finished', () => {
        expect(nextProgressCue(args({ completed: true, remaining: 0 }))).toBeNull();
        expect(nextProgressCue(args({ remaining: 0 }))).toBeNull();
    });

    it('calls out the final word above everything else', () => {
        expect(nextProgressCue(args({ remaining: 1, outcome: 'struck_out' }))).toBe('final_word');
        expect(nextProgressCue(args({ remaining: 1, consecutive: 3 }))).toBe('final_word');
    });

    it('reassures after a miss', () => {
        expect(nextProgressCue(args({ outcome: 'struck_out' }))).toBe('recover');
        expect(nextProgressCue(args({ outcome: 'gave_up' }))).toBe('recover');
    });

    it('announces the streak multiplier exactly once', () => {
        expect(nextProgressCue(args({ consecutive: 2 }))).toBeNull();
        expect(nextProgressCue(args({ consecutive: 3 }))).toBe('streak');
        expect(nextProgressCue(args({ consecutive: 4 }))).toBeNull();
    });

    it('marks the halfway crossing on the move that makes it', () => {
        // 8 words: the move leaving 4 crosses the midpoint.
        expect(nextProgressCue(args({ total: 8, remaining: 5 }))).toBeNull();
        expect(nextProgressCue(args({ total: 8, remaining: 4 }))).toBe('halfway');
        expect(nextProgressCue(args({ total: 8, remaining: 3 }))).toBeNull();
    });

    it('marks the halfway crossing on an odd chain too', () => {
        expect(nextProgressCue(args({ total: 7, remaining: 4 }))).toBeNull();
        expect(nextProgressCue(args({ total: 7, remaining: 3 }))).toBe('halfway');
        expect(nextProgressCue(args({ total: 7, remaining: 2 }))).toBeNull();
    });

    it('prefers the streak over the halfway crossing', () => {
        expect(nextProgressCue(args({ total: 8, remaining: 4, consecutive: 3 }))).toBe('streak');
    });

    it('prefers reassurance over the halfway crossing', () => {
        expect(nextProgressCue(args({ total: 8, remaining: 4, outcome: 'gave_up' }))).toBe('recover');
    });
});
