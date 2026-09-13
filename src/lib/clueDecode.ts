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
 * only part worth testing: how a clue is cut into words, how many glyphs stand
 * in for the part of a word still hidden, and which glyph each of them is.
 *
 * ## Why any of this is width-aware
 *
 * The first version masked character for character and let the string reflow.
 * A cipher glyph is not the width of a letter: measured off the two fonts this
 * app actually serves, Noto Sans Symbols 2's signs average **0.88em** while
 * Rubik's lowercase averages **0.51em**. So a fully masked clue was about
 * *1.7x* the width of the clue it was hiding — two extra lines on a phone —
 * and every character that decoded gave a little of that width back. The box
 * shed a line, then another, while the player was trying to read it.
 *
 * Two things follow, and together they make the decode dimensionally inert:
 *
 * 1. The mask is **shorter than what it hides** (`maskedLength`), so a masked
 *    word is about as wide as the word itself rather than twice it.
 * 2. The glyphs are drawn from `CLUE_SIGNS` — the signs that are actually in
 *    the `symbols` subset the app loads. The other two thirds of `CIPHER_SIGNS`
 *    (the alchemical, planetary and math blocks) fall through to whatever the
 *    device has, at whatever width that font happens to use, which is neither
 *    predictable nor the same on two phones.
 *
 * The component does the rest: each word is laid out at the width of its final
 * text, so nothing reflows even if a frame's glyphs run a few pixels over.
 */

/**
 * The masking alphabet for a clue: the signs from `CIPHER_SIGNS` that Noto Sans
 * Symbols 2 ships in the `symbols` subset (`src/app/[locale]/layout.tsx`), so
 * every one of them renders from the font the app loads rather than from a
 * system fallback.
 *
 * `❘❙❚` are excluded deliberately though they qualify: at 0.21–0.49em they are
 * bars rather than signs, and mixing them in makes the mask's width jump
 * between frames.
 */
export const CLUE_SIGNS = [...'⊙⌖◆◇▲▼○●⬡⬢⬟★☆☉✵✶✷✸✹✺✱✲✢✣✤✥✦❈❉❊❋❀❁❂❃❖✧✩✪✫✬✭✮✯'];

/** Mean advance of `CLUE_SIGNS`, in em, measured from Noto Sans Symbols 2. */
const GLYPH_EM = 0.88;

/** Mean advance of Rubik lowercase, in em, measured from the font. */
const LETTER_EM = 0.51;

/**
 * Glyphs per hidden character — the ratio that keeps a mask the width of the
 * text under it. Roughly three glyphs for every five letters.
 */
export const GLYPHS_PER_CHAR = LETTER_EM / GLYPH_EM;

/** Longest a clue may take to decode, however long it is. */
export const DECODE_BUDGET_MS = 900;

/** Floor and ceiling on the per-character step, so short clues are not instant. */
export const MIN_STEP_MS = 16;
export const MAX_STEP_MS = 45;

/** Characters that are ever masked: spaces and punctuation hold the line's shape. */
const MASKABLE = /[\p{L}\p{N}]/u;

/**
 * A run of the clue that is masked as a unit (`word`), or one that is never
 * masked at all (`gap`: spaces, punctuation, anything that is not a letter or a
 * digit). `start` counts code points from the beginning of the clue, which is
 * what the reveal counter counts.
 */
export type ClueSegment = {
    kind: 'word' | 'gap';
    text: string;
    start: number;
};

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
 * The clue cut into maskable words and the gaps between them.
 *
 * Segmenting is what lets the component give each word a box the size of its
 * own final text: the mask then changes what is inside a box, never how many
 * boxes fit on a line. Concatenating the segments returns the clue unchanged.
 */
export function splitClue(text: string): ClueSegment[] {
    const chars = Array.from(text);
    const segments: ClueSegment[] = [];

    for (let i = 0; i < chars.length; i += 1) {
        const kind: ClueSegment['kind'] = MASKABLE.test(chars[i]) ? 'word' : 'gap';
        const last = segments[segments.length - 1];

        if (last && last.kind === kind) {
            last.text += chars[i];
            continue;
        }

        segments.push({ kind, text: chars[i], start: i });
    }

    return segments;
}

/**
 * How many glyphs stand in for `hidden` characters.
 *
 * Rounded rather than floored, and never zero while anything is still hidden:
 * a word one character from the end must still show that something is missing.
 */
export function maskedLength(hidden: number): number {
    if (hidden <= 0) return 0;

    return Math.max(1, Math.round(hidden * GLYPHS_PER_CHAR));
}

/**
 * One frame of one word: the characters decoded so far, then glyphs for the
 * rest.
 *
 * The glyph pick is deterministic in `offset`, `frame` and position — same
 * inputs, same sign — so a re-render mid-animation never reshuffles what the
 * player is looking at, while advancing the frame churns the tail instead of
 * leaving a fixed nonsense word sitting there.
 */
export function maskWord(word: string, revealed: number, frame: number, offset = 0): string {
    // Code points, not UTF-16 units: a clue may be Hebrew, Arabic or carry an
    // emoji, and indexing by unit would slice a pair in half.
    const chars = Array.from(word);
    const legible = Math.max(0, Math.min(revealed, chars.length));
    const hidden = chars.length - legible;

    let out = chars.slice(0, legible).join('');

    for (let i = 0; i < maskedLength(hidden); i += 1) {
        out += CLUE_SIGNS[((offset + legible + i) * 7 + frame * 3) % CLUE_SIGNS.length];
    }

    return out;
}

/** A run of glyphs to stand in for a clue that has not arrived yet. */
export function placeholderGlyphs(length: number, frame: number): string {
    let out = '';

    for (let i = 0; i < length; i += 1) {
        out += CLUE_SIGNS[(i * 7 + frame * 3) % CLUE_SIGNS.length];
    }

    return out;
}
