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
        }).unknown).toEqual([CIPHER_SIGNS[5]]);
    });

    it("uses the word's own revealed letters, capitalising only the opening tile", () => {
        const mask = [...maskFor('teacup')];
        mask[0] = 't';

        // 'cap' shares c, a and p with the answer but lands none of them on its
        // own index, so every one of them is orange and none is green.
        const samples = pickLegendSamples({
            text: 'teacup',
            cipherText: mask.join(''),
            guesses: ['cap'],
            hintLevel: 1,
        });

        expect(samples.placed).toEqual(['T']);
        expect(samples.present).toEqual(['a', 'c', 'p']);
    });

    it('leaves a letter found away from the opening tile in lower case', () => {
        const mask = [...maskFor('teacup')];
        mask[3] = 'c';

        expect(pickLegendSamples({
            text: 'teacup',
            cipherText: mask.join(''),
            guesses: [],
            hintLevel: 1,
        }).placed).toEqual(['c']);
    });

    it('reads a shuffled word the way the scramble view draws it', () => {
        // The bug this pins: from hint level 2 the mask is an anagram, so the
        // positional reader calls every letter in it `present` and the key
        // showed a stand-in `A` for green while a pinned green letter — the
        // guaranteed first letter — sat in the bubble above it.
        const mask = [...maskFor('whisper')];
        mask[0] = 'w';
        mask[2] = 'h';
        mask[4] = 's';

        const samples = pickLegendSamples({
            text: 'whisper',
            cipherText: mask.join(''),
            guesses: [],
            hintLevel: 2,
        });

        expect(samples.placed).toEqual(['W']);
        expect(samples.present).toEqual(['h', 's']);
        expect(samples.unknown).toEqual([CIPHER_SIGNS[0]]);
    });

    it('offers several oranges, since one letter reads as an arbitrary pick', () => {
        const samples = pickLegendSamples({
            text: 'whisper',
            cipherText: maskFor('whisper'),
            guesses: ['wisher'],
            hintLevel: 0,
        });

        expect(samples.present.length).toBeGreaterThan(1);
    });

    it('caps each state so the key cannot outgrow the bubble', () => {
        const samples = pickLegendSamples({
            text: 'whisper',
            cipherText: 'whisper',
            guesses: ['whisper'],
            hintLevel: 1,
        });

        expect(samples.placed.length).toBeLessThanOrEqual(2);
        expect(samples.present.length).toBeLessThanOrEqual(4);
        expect(samples.unknown.length).toBeLessThanOrEqual(1);
    });

    it('never offers a space as an example', () => {
        const samples = pickLegendSamples({
            text: 'tea cup',
            cipherText: maskFor('tea cup'),
            guesses: ['tea'],
            hintLevel: 0,
        });

        expect(Object.values(samples).flat().every((char) => char.trim().length > 0)).toBe(true);
    });

    it('survives a missing cipher text', () => {
        expect(pickLegendSamples({ text: 'teacup', cipherText: null, guesses: [], hintLevel: 0 }))
            .toEqual(DEFAULT_LEGEND_SAMPLES);
    });
});
