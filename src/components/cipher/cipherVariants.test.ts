import { describe, it, expect } from 'vitest';
import { motionState, tiltSeed } from './cipherVariants';
import { buildScrambleItems, computeGuessState, generateShuffledView } from './cipherRules';

describe('tiltSeed', () => {
    it('is stable for the same tile id', () => {
        expect(tiltSeed('3-o')).toBe(tiltSeed('3-o'));
    });

    it('survives a real shuffle, because ids encode the letter not the slot', () => {
        // Passing the array index instead was what made letters twitch: every
        // shuffle reassigned the tilts by slot. Shuffle until something actually
        // moves, then check that tile's seed did not change with it.
        const items = buildScrambleItems({
            textChars: [...'Harmony'],
            cipherChars: [...'Harmony'],
            guessState: computeGuessState('Harmony', []),
            hintLevel: 0,
        });
        const seedsById = new Map(items.map((item) => [item.id, tiltSeed(item.id)]));

        let moved = false;
        for (let attempt = 0; attempt < 50 && !moved; attempt++) {
            const shuffled = generateShuffledView(items);
            shuffled.forEach((item, slot) => {
                if (items[slot].id !== item.id) moved = true;
                expect(tiltSeed(item.id)).toBe(seedsById.get(item.id));
            });
        }

        expect(moved).toBe(true);
    });

    it('separates tiles that differ only by position', () => {
        expect(tiltSeed('3-o')).not.toBe(tiltSeed('4-o'));
    });

    it('stays a small non-negative number for any id', () => {
        for (const id of ['0-a', '12-⊗', '999-🜁', '']) {
            const seed = tiltSeed(id);
            expect(seed).toBeGreaterThanOrEqual(0);
            expect(seed).toBeLessThan(100_000);
            expect(Number.isInteger(seed)).toBe(true);
        }
    });
});

describe('motionState', () => {
    it('leaves a settled tile unanimated', () => {
        expect(motionState({ flashing: false, displaced: false, reduced: false })).toBeUndefined();
    });

    it('drifts a displaced tile', () => {
        expect(motionState({ flashing: false, displaced: true, reduced: false })).toBe('float');
    });

    it('keeps the tilt but drops the drift under reduced motion', () => {
        // The static angle is not movement, and it is the only per-tile cue that
        // a slot is meaningless — dropping it would cost the signal entirely.
        expect(motionState({ flashing: false, displaced: true, reduced: true })).toBe('tilt');
    });

    it('never animates a settled tile, reduced motion or not', () => {
        expect(motionState({ flashing: false, displaced: false, reduced: true })).toBeUndefined();
    });

    it('flashes a newly revealed letter, and outranks the drift', () => {
        expect(motionState({ flashing: true, displaced: true, reduced: false })).toBe('pop');
    });

    it('flashes without the scale jump under reduced motion', () => {
        expect(motionState({ flashing: true, displaced: false, reduced: true })).toBe('popStill');
    });
});
