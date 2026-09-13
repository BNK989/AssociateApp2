import { maskGivesPosition, maskIsScrambled } from '@/lib/gameConfig';
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
 * so does any letter a mask that *hands over position* exposes.
 *
 * Which masks those are is `maskGivesPosition`'s answer, never a comparison
 * against the hint level and — the trap this file fell into — never
 * `maskIsScrambled`. Those are two questions: one asks whether the line is
 * drawn in the answer's order, the other whether a letter in the mask may be
 * read as being at its own index. They coincided only while hint 2's mask was
 * an anagram, because shuffling was *how* the position was withheld. With
 * `SCRAMBLE_MASK` off the mask is in order at every level and still withholds
 * position from hint 2 — the letters it discloses belong in the halo, not here.
 * Reading the shuffle flag instead drew all of them in the line as greens.
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
        // Hint level 1 buys the first letter, and it stays bought. Checked
        // before the mask is consulted, and answered from the answer itself, so
        // the guarantee holds whatever the mask happens to carry at index 0.
        //
        // It used to live only in `buildScrambleItems` — the shuffled view,
        // switched off once unplaced letters moved to the pool. Nothing else
        // carried it, so from hint 2 the letter the player had paid for
        // silently vanished from the word.
        if (realChar && hintLevel >= 1 && index === 0) {
            return { char: realChar, state: 'placed', displaced: false };
        }

        const isMaskLetter = maskChar !== ' ' && maskChar !== undefined && !isFillerChar(maskChar);

        // A mask that hands over position exposes a letter at its own index, so
        // it belongs to the line and stays. Asked through `maskGivesPosition`,
        // which is a different question from whether the mask is *shuffled*:
        // asking `maskIsScrambled` here is what put every letter hint 2
        // disclosed into the line as a green and left the halo empty. An
        // in-order mask withholds position perfectly well — nothing obliges
        // this reader to draw its letters where the mask happens to hold them.
        if (isMaskLetter && maskGivesPosition(hintLevel)) {
            return { char: maskChar, state: 'placed', displaced: false };
        }

        // Anything else is unplaced: filler is already filler, and a letter the
        // mask is holding without its position is replaced by filler so no real
        // glyph leaks through wearing filler's colour — the letter itself is in
        // the halo, which is the only place it can be shown without asserting a
        // position it does not have. Keyed to the index so it never flickers.
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
        // Only the shuffled line reaches here, and there a slot really is a lie,
        // so `maskIsScrambled` is the right question for `displaced`. What the
        // letter *means* is still `maskGivesPosition`'s to answer, or this view
        // would call a letter placed that the pool is simultaneously holding as
        // adrift.
        const scrambled = maskIsScrambled(hintLevel);
        return {
            char: maskChar,
            state: maskGivesPosition(hintLevel) ? 'placed' : 'present',
            displaced: scrambled,
        };
    }

    return { char: maskChar, state: 'unknown', displaced: false };
}
