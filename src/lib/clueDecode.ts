import { CIPHER_SIGNS } from '@/lib/gameConfig';

/**
 * Turning a clue into something that arrives the way the rest of the board does.
 *
 * Every other reveal in this game is a mask coming off: the bubble's cipher
 * resolves into letters, the letter tiles land, the word settles. The clue was
 * the one thing that simply appeared — an amber box faded in with the answer's
 * description already written in it — which is why it read as a different
 * product bolted onto the game.
 *
 * So it decodes instead, out of the same glyph alphabet the bubbles are masked
 * with. The arithmetic lives here, apart from the component, because it is the
 * only part worth testing: given a clue, how much of it is legible on a given
 * frame, and which glyph stands in for the rest.
 */

/** Longest a clue may take to decode, however long it is. */
export const DECODE_BUDGET_MS = 900;

/** Floor and ceiling on the per-character step, so short clues are not instant. */
export const MIN_STEP_MS = 16;
export const MAX_STEP_MS = 45;

/** Characters that are never masked: spaces hold the line's shape, punctuation its rhythm. */
const MASKABLE = /[\p{L}\p{N}]/u;

/**
 * How long each character waits its turn.
 *
 * A fixed step would make a long clue crawl for four seconds while the player
 * waits to read it — the animation getting in the way of the help it is
 * delivering. The budget is shared out instead, and clamped at both ends so a
 * three-word clue still decodes rather than blinking into place.
 */
export function decodeStepMs(length: number): number {
    if (length <= 0) return MAX_STEP_MS;

    const share = DECODE_BUDGET_MS / length;
    return Math.max(MIN_STEP_MS, Math.min(MAX_STEP_MS, Math.round(share)));
}

/** Steps needed before a clue is fully legible, counted in code points. */
export function decodeSteps(text: string): number {
    return Array.from(text).length;
}

/**
 * The clue as it looks on one frame of the decode.
 *
 * `revealed` characters read plainly from the start of the string; the rest
 * stand in as cipher glyphs picked from `frame`, so the undecoded tail churns
 * rather than sitting there as a fixed nonsense word. The pick is deterministic
 * — same index and frame, same glyph — so a re-render mid-animation never
 * reshuffles what the player is looking at.
 */
export function decodeFrame(text: string, revealed: number, frame: number): string {
    // Code points, not UTF-16 units: the glyph alphabet reaches into the
    // alchemical block, where a sign is a surrogate pair. Indexing by unit
    // would slice one in half and paint a replacement character.
    const chars = Array.from(text);
    let out = '';

    for (let i = 0; i < chars.length; i += 1) {
        const char = chars[i];

        if (i < revealed || !MASKABLE.test(char)) {
            out += char;
            continue;
        }

        out += CIPHER_SIGNS[(i * 7 + frame * 3) % CIPHER_SIGNS.length];
    }

    return out;
}

/** A run of glyphs to stand in for a clue that has not arrived yet. */
export function placeholderGlyphs(length: number, frame: number): string {
    return decodeFrame('x'.repeat(length), 0, frame);
}
