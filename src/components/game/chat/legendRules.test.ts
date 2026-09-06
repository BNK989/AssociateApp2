import { describe, it, expect } from 'vitest';
import { CIPHER_SIGNS } from '@/lib/gameConfig';
import { DEFAULT_LEGEND_SAMPLES, hasColouredTiles, pickLegendSamples } from './legendRules';

/** A fully masked word: every position is filler, so nothing carries colour. */
function maskFor(text: string): string {
    return [...text].map((c) => (c === ' ' ? ' ' : CIPHER_SIGNS[0])).join('');
}

describe('hasColouredTiles', () => {
    it('is false for a word that is still entirely masked', () => {
        expect(hasColouredTiles({
            text: 'teacup',
            cipherText: maskFor('teacup'),
            guesses: [],
            hintLevel: 0,
        })).toBe(false);
    });

    it('is true once a guess reveals a letter, even at hint level 0', () => {
        expect(hasColouredTiles({
            text: 'teacup',
            cipherText: maskFor('teacup'),
            guesses: ['tulip'],
            hintLevel: 0,
        })).toBe(true);
    });

    it('is true when the mask itself exposes a real letter', () => {
        const mask = maskFor('teacup').split('');
        mask[0] = 't';
        expect(hasColouredTiles({
            text: 'teacup',
            cipherText: mask.join(''),
            guesses: [],
            hintLevel: 1,
        })).toBe(true);
    });

    it('is false at hint level 1 when the mask happens to expose nothing', () => {
        expect(hasColouredTiles({
            text: 'teacup',
            cipherText: maskFor('teacup'),
            guesses: [],
            hintLevel: 1,
        })).toBe(false);
    });

    it('survives a missing cipher text', () => {
        expect(hasColouredTiles({ text: 'teacup', cipherText: null, guesses: [], hintLevel: 0 }))
            .toBe(false);
        expect(hasColouredTiles({ text: 'teacup', cipherText: null, guesses: ['teacup'], hintLevel: 0 }))
            .toBe(true);
    });

    it('ignores spaces, which are never coloured', () => {
        expect(hasColouredTiles({
            text: 'tea cup',
            cipherText: maskFor('tea cup'),
            guesses: [],
            hintLevel: 0,
        })).toBe(false);
    });
});

describe('pickLegendSamples', () => {
    it('falls back to the generic examples while the word shows nothing', () => {
        expect(pickLegendSamples({
            text: 'teacup',
            cipherText: maskFor('teacup'),
            guesses: [],
            hintLevel: 0,
        })).toEqual(DEFAULT_LEGEND_SAMPLES);
    });

    it('takes the hidden sign from this word mask, not a fixed glyph', () => {
        const mask = [...maskFor('teacup')];
        mask[0] = 't';
        mask[1] = CIPHER_SIGNS[5];

        expect(pickLegendSamples({
            text: 'teacup',
            cipherText: mask.join(''),
            guesses: [],
            hintLevel: 1,
        }).unknown).toBe(CIPHER_SIGNS[5]);
    });

    it("uses the word's own revealed letters, capitalising only the opening tile", () => {
        const mask = [...maskFor('teacup')];
        mask[0] = 't';

        // 'cap' shares c, a and p with the answer but lands none of them on its
        // own index, so the first orange tile is the 'a' at index 2.
        const samples = pickLegendSamples({
            text: 'teacup',
            cipherText: mask.join(''),
            guesses: ['cap'],
            hintLevel: 1,
        });

        expect(samples.placed).toBe('T');
        expect(samples.present).toBe('a');
    });

    it('leaves a letter found away from the opening tile in lower case', () => {
        const mask = [...maskFor('teacup')];
        mask[3] = 'c';

        expect(pickLegendSamples({
            text: 'teacup',
            cipherText: mask.join(''),
            guesses: [],
            hintLevel: 1,
        }).placed).toBe('c');
    });

    it('never offers a space as an example', () => {
        const samples = pickLegendSamples({
            text: 'tea cup',
            cipherText: maskFor('tea cup'),
            guesses: ['tea'],
            hintLevel: 0,
        });

        expect(Object.values(samples).every((char) => char.trim().length > 0)).toBe(true);
    });

    it('survives a missing cipher text', () => {
        expect(pickLegendSamples({ text: 'teacup', cipherText: null, guesses: [], hintLevel: 0 }))
            .toEqual(DEFAULT_LEGEND_SAMPLES);
    });
});
