import { describe, it, expect } from 'vitest';
import { CIPHER_SIGNS } from '@/lib/gameConfig';
import { hasColouredTiles } from './legendRules';

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
