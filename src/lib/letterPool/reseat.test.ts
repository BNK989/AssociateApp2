import { describe, expect, it } from 'vitest';
import { reseatTyped } from './reseat';
import type { Slot } from './slotRules';

/** A strip, written compactly: `-` is a gap, upper is green, lower is typed. */
function strip(spec: string): Slot[] {
    return [...spec].map((ch, index) => {
        if (ch === '-') return { kind: 'gap', index, char: ' ' } as Slot;
        if (ch === '.') return { kind: 'open', index } as Slot;
        if (ch === ch.toUpperCase()) return { kind: 'green', index, char: ch } as Slot;
        return { kind: 'open', index, char: ch } as Slot;
    });
}

describe('reseatTyped', () => {
    /**
     * The defect this replaces: the composer used to clear the field outright
     * whenever a letter settled, so the player watched their own work vanish at
     * the moment the game claimed to be helping them.
     */
    it('keeps the keystrokes that still have their slot', () => {
        // P _ _ _ _ with the player having typed into the first two gaps, and
        // the third position settling underneath them.
        const slots = strip('Pul..');

        expect(reseatTyped({ typed: 'ul', slots, reading: 'gaps', settled: [3] }))
            .toBe('ul');
    });

    it('drops only the keystroke whose slot the new letter took', () => {
        const slots = strip('Pulxy');

        // Index 2 settles: the `l` sitting there goes, `u`, `x` and `y` stay.
        expect(reseatTyped({ typed: 'ulxy', slots, reading: 'gaps', settled: [2] }))
            .toBe('uxy');
    });

    it('keeps everything when the letter lands in a slot nobody typed into', () => {
        const slots = strip('Pul..');

        expect(reseatTyped({ typed: 'ul', slots, reading: 'gaps', settled: [4] }))
            .toBe('ul');
    });

    // Under the whole-word reading the keystrokes already cover every typeable
    // position, so a settled letter agrees with what is there.
    it('leaves a whole-word attempt completely alone', () => {
        const slots = strip('pulley');

        expect(reseatTyped({ typed: 'pulley', slots, reading: 'whole', settled: [3] }))
            .toBe('pulley');
    });

    it('survives more settled letters than the player typed', () => {
        const slots = strip('Pu...');

        expect(reseatTyped({ typed: 'u', slots, reading: 'gaps', settled: [1, 2, 3] }))
            .toBe('');
    });

    it('is a no-op on an empty field', () => {
        expect(reseatTyped({ typed: '', slots: strip('P....'), reading: 'gaps', settled: [2] }))
            .toBe('');
    });

    it('ignores gaps, which never hold a keystroke', () => {
        const slots = strip('Ab-cd');

        expect(reseatTyped({ typed: 'bcd', slots, reading: 'gaps', settled: [3] }))
            .toBe('bd');
    });
});
