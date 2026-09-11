import { describe, expect, it } from 'vitest';
import { readMaskTile } from './maskTile';
import { computeGuessState } from './cipherRules';
import { CIPHER_SIGNS } from '@/lib/gameConfig';

const FILLER = CIPHER_SIGNS[0];
const state = (text: string, guesses: string[]) => computeGuessState(text, guesses);

describe('readMaskTile — hiding unplaced letters', () => {
    it('still draws a confirmed letter in the line', () => {
        const tile = readMaskTile(FILLER, 'H', 0, state('Harmony', ['harpoon']), 0, true);
        expect(tile).toMatchObject({ char: 'H', state: 'placed' });
    });

    // The whole point: a letter the player has found but cannot place must not
    // appear inside a line of text, because a line of text means sequence.
    it('does not draw a found letter whose place is unknown', () => {
        const tile = readMaskTile(FILLER, 'n', 5, state('Harmony', ['harpoon']), 0, true);
        expect(tile.state).toBe('unknown');
        expect(tile.char).not.toBe('n');
    });

    it('keeps a positional reveal below hint 2, where the mask is honest', () => {
        const tile = readMaskTile('H', 'H', 0, state('Harmony', []), 1, true);
        expect(tile).toMatchObject({ char: 'H', state: 'placed', displaced: false });
    });

    it('replaces an anagram letter with filler, so no real glyph leaks as filler', () => {
        // Index 3, not 0: the first letter is bought at hint 1 and stays shown.
        const tile = readMaskTile('y', 'm', 3, state('Harmony', []), 2, true);
        expect(tile.state).toBe('unknown');
        expect(tile.char).not.toBe('y');
    });

    // Regression: the first-letter guarantee lived only in `buildScrambleItems`,
    // which stopped running when unplaced letters moved to the pool. From hint 2
    // the letter the player had paid for silently disappeared from the word.
    it('keeps the first letter from hint 1, at every level above it', () => {
        for (const level of [1, 2, 3]) {
            expect(readMaskTile('y', 'H', 0, state('Harmony', []), level, true))
                .toMatchObject({ char: 'H', state: 'placed' });
        }
    });

    it('does not give the first letter away below hint 1', () => {
        expect(readMaskTile(FILLER, 'H', 0, state('Harmony', []), 0, true).state).toBe('unknown');
    });

    it('picks that filler from the index, so a hidden position never shimmers', () => {
        const first = readMaskTile('y', 'H', 3, state('Harmony', []), 2, true);
        const again = readMaskTile('y', 'H', 3, state('Harmony', []), 2, true);
        expect(first.char).toBe(again.char);
    });

    it('leaves existing filler and spaces exactly as they are', () => {
        expect(readMaskTile(FILLER, 'm', 3, state('Harmony', []), 2, true).char).toBe(FILLER);
        expect(readMaskTile(' ', ' ', 2, state('go on', []), 2, true).char).toBe(' ');
    });

    it('never reports a displaced tile, since nothing unplaced is drawn', () => {
        for (const level of [0, 1, 2, 3]) {
            expect(readMaskTile('y', 'H', 0, state('Harmony', ['harpoon']), level, true).displaced).toBe(false);
        }
    });
});

describe('readMaskTile — the original behaviour is untouched when the pool is off', () => {
    it('draws a found letter at its true index', () => {
        const tile = readMaskTile(FILLER, 'n', 5, state('Harmony', ['harpoon']), 0);
        expect(tile).toMatchObject({ char: 'n', state: 'present', displaced: false });
    });

    it('marks an anagram letter as displaced from hint 2', () => {
        expect(readMaskTile('y', 'H', 0, state('Harmony', []), 2)).toMatchObject({
            state: 'present', displaced: true,
        });
    });
});
