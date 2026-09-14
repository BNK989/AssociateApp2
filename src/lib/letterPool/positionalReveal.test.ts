import { describe, expect, it } from 'vitest';
import { maskWithholdsPositions } from '@/lib/gameConfig';
import { generateCipherString } from '@/lib/gameLogic';
import { computeGuessState } from '@/components/cipher/cipherRules';
import { readMaskTile } from '@/components/cipher/maskTile';
import { knownUnplacedIndices, placedIndices } from './poolRules';

/**
 * What hint 2 actually reaches the player with — **read without mocking the
 * switch**.
 *
 * Every other suite over this surface forces `HINT_2_WITHHOLDS_POSITIONS: true`
 * at module level. For the one day the switch shipped off (2026-09-13) that
 * meant the whole mask/pool/settle path was only exercised in a world the game
 * did not ship, and a hint 2 that revealed nothing got through green:
 * `readMaskTile` and `placedIndices` both still asked `hintLevel < 2` instead
 * of `maskWithholdsPositions`, so the mask's letters were glyphed out of the
 * line, left out of the strip, and never pooled either. Revealed in
 * `cipher_text`, reaching nothing on screen.
 *
 * So these cases **read** the switch rather than setting it. Every assertion
 * below holds under either setting; only the route the letters take changes —
 * into the pool when the mask is an anagram (as shipped), into the line when
 * it is honest. Flip `HINT_2_WITHHOLDS_POSITIONS` either way and this suite
 * keeps testing the shipped game instead of quietly going vacuous.
 */

const WORD = 'clotheslines';
/** A word the player has not guessed at. Hint disclosure is the whole subject. */
const NO_GUESSES: string[] = [];

/** The mask a given hint level puts on the message. */
const maskAt = (level: number) => ({
    cipher: generateCipherString(WORD, level, true),
    hintLevel: level,
});

/** Positions the word line draws as real letters rather than as filler. */
function drawnInLine(cipher: string, hintLevel: number, guesses: string[]): number[] {
    const guessState = computeGuessState(WORD, guesses);
    const maskChars = [...cipher];

    return [...WORD].flatMap((realChar, index) => {
        const tile = readMaskTile(maskChars[index], realChar, index, guessState, hintLevel, true);
        return tile.state === 'unknown' ? [] : [index];
    });
}

/** Everything the player can read off the board: the line plus the pool. */
function disclosedAt(level: number): number {
    const mask = maskAt(level);
    return drawnInLine(mask.cipher, level, NO_GUESSES).length
        + knownUnplacedIndices(WORD, NO_GUESSES, mask).length;
}

describe('hint 2 discloses letters, whatever shape the mask has', () => {
    it('gives the player more than hint 1 did', () => {
        // The defect, stated as the player met it: the clue was showing, the
        // mask held two thirds of the word, and the line drew one letter.
        expect(disclosedAt(2)).toBeGreaterThan(disclosedAt(1));
    });

    it('routes them into the line when the mask is positional, the pool when it is not', () => {
        const mask = maskAt(2);
        const line = drawnInLine(mask.cipher, 2, NO_GUESSES);
        const pool = knownUnplacedIndices(WORD, NO_GUESSES, mask);

        if (maskWithholdsPositions(2)) {
            // An anagram's slots mean nothing, so nothing but the bought first
            // letter may be drawn in place.
            expect(line).toEqual([0]);
            expect(pool.length).toBeGreaterThan(1);
        } else {
            expect(line.length).toBeGreaterThan(1);
            // Nothing is adrift: a positional mask hands over position too, so
            // every letter it exposes has a place and the pool stays empty.
            expect(pool).toEqual([]);
        }
    });

    it('leaves the clue level showing exactly what level 2 showed', () => {
        // Level 3 is the clue on top of the level-2 mask, not a mask of its own.
        const mask = maskAt(2);
        expect(drawnInLine(mask.cipher, 3, NO_GUESSES))
            .toEqual(drawnInLine(mask.cipher, 2, NO_GUESSES));
    });
});

describe('the line and the composer strip agree', () => {
    // Two readings of one question, in two modules that each used to ask it in
    // their own words. They were wrong together rather than apart, so this is
    // not the case that catches the original defect — the cases above are. It
    // is here to stop the next one being fixed on one side only, which would
    // leave the line drawing a letter the strip still asks the player to type.
    it.each([0, 1, 2, 3])('at hint level %i', (level) => {
        const mask = maskAt(Math.min(level, 2));
        const placed = placedIndices(WORD, NO_GUESSES, { ...mask, hintLevel: level });

        expect(drawnInLine(mask.cipher, level, NO_GUESSES)).toEqual([...placed].sort((a, b) => a - b));
    });
});

describe('no revealed letter is dropped on the floor', () => {
    it('every real letter in the mask is either drawn or pooled', () => {
        const mask = maskAt(2);
        const drawn = drawnInLine(mask.cipher, 2, NO_GUESSES).length;
        const pooled = knownUnplacedIndices(WORD, NO_GUESSES, mask).length;

        // What the server chose to disclose, counted at the source.
        const revealed = [...mask.cipher].filter(
            (char, index) => char === [...WORD][index],
        ).length;

        expect(drawn + pooled).toBeGreaterThanOrEqual(revealed);
    });
});
