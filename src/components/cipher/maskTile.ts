import { isFillerChar, maskedGlyph } from './fillers';
import type { GuessState } from './cipherRules';

/**
 * Reading one position of a mask into the tile the renderer draws.
 *
 * Its own module because it is the single decision that governs what a player
 * is allowed to see in the word line, and it grew a second mode when unplaced
 * letters moved out to the pool.
 */

/**
 * What a tile is telling the player.
 *
 * - `placed`: the letter is real *and* the slot it occupies is its real one.
 * - `present`: the letter is in the answer. Whether its slot means anything is a
 *   separate question, answered by `displaced` at the point of rendering.
 * - `unknown`: masking filler, carrying no information at all.
 */
export type TileState = 'placed' | 'present' | 'unknown';

/** What one position of a mask is showing, and whether its slot can be trusted. */
export type MaskTile = {
    char: string;
    state: TileState;
    /** True when the slot is not the letter's own, so its order means nothing. */
    displaced: boolean;
};

/**
 * Reads a single position of a mask into the tile the renderer draws.
 *
 * The rule the whole colour scheme rests on: a tile is `placed` only when its
 * slot is genuinely the letter's own. Letters guessed in position qualify, and
 * so does any letter the mask exposes below hint level 2, because those masks
 * are built position by position and are positionally honest.
 *
 * From level 2 the mask is an *anagram* of the answer, so a letter in it
 * belongs to the word but its slot means nothing — `present` and displaced.
 * A letter that happens to land on its own index there is coincidence, not
 * information, so it is never promoted to `placed`.
 *
 * Letters known only to be present are drawn at their true index and reported
 * as *not* displaced. That is the honest reading: the renderer really does put
 * them where they belong, which is why describing them as "wrong spot" was
 * false rather than merely vague.
 */
export function readMaskTile(
    maskChar: string,
    realChar: string | undefined,
    index: number,
    { greenIndices, revealedChars }: GuessState,
    hintLevel: number,
    hideUnplaced = false,
): MaskTile {
    if (realChar && greenIndices.has(index)) {
        return { char: realChar, state: 'placed', displaced: false };
    }

    if (hideUnplaced) {
        // The line now carries position and nothing else. A letter with no
        // confirmed place is not drawn here at all — it is in the pool above
        // the composer, where its slot cannot be misread as its position.
        const isMaskLetter = maskChar !== ' ' && maskChar !== undefined && !isFillerChar(maskChar);

        // Below hint 2 the mask is built position by position, so a letter it
        // exposes genuinely belongs at that index and stays.
        if (isMaskLetter && hintLevel < 2) {
            return { char: maskChar, state: 'placed', displaced: false };
        }

        // Anything else is unplaced: filler is already filler, and a letter from
        // an anagram mask is replaced by filler so no real glyph leaks through
        // wearing filler's colour. Keyed to the index so it never flickers.
        return {
            char: isMaskLetter ? maskedGlyph(index) : maskChar,
            state: 'unknown',
            displaced: false,
        };
    }

    if (realChar && revealedChars.has(realChar.toLowerCase())) {
        return { char: realChar, state: 'present', displaced: false };
    }

    if (maskChar !== ' ' && maskChar !== undefined && !isFillerChar(maskChar)) {
        const scrambled = hintLevel >= 2;
        return {
            char: maskChar,
            state: scrambled ? 'present' : 'placed',
            displaced: scrambled,
        };
    }

    return { char: maskChar, state: 'unknown', displaced: false };
}
