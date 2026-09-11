import { CIPHER_SIGNS } from '@/lib/gameConfig';

/**
 * The masking alphabet and the ways a position is filled with it.
 *
 * Split out of `cipherRules` so that `maskTile` can read it without the two
 * importing each other: both need to know what filler is, and neither should
 * own it.
 */

/**
 * The masking alphabet, as a set for membership tests.
 *
 * Derived from the very array the server masks with rather than restated, which
 * is the whole point of it. This used to be a hand-maintained ASCII list
 * documented as "must match gameLogic.ts" that in fact shared no character with
 * it. Every glyph the server actually emits therefore failed the "is this
 * filler?" test, and the renderer styled meaningless noise exactly like a
 * revealed letter. One source removes the chance of drifting again.
 */
const FILLER_CHARS = new Set(CIPHER_SIGNS);

/** True when a character is masking filler rather than a letter of the answer. */
export function isFillerChar(char: string): boolean {
    return FILLER_CHARS.has(char);
}

/** A filler glyph drawn from the same alphabet the server masks with. */
export function randomFiller(): string {
    return CIPHER_SIGNS[Math.floor(Math.random() * CIPHER_SIGNS.length)];
}

/**
 * A filler glyph for one position, stable across renders.
 *
 * Keyed to the index rather than drawn at random because this one is chosen on
 * the render path: a fresh glyph every frame would make a hidden position
 * shimmer, which is exactly the attention the line is trying not to draw.
 */
export function maskedGlyph(index: number): string {
    return CIPHER_SIGNS[index % CIPHER_SIGNS.length];
}
