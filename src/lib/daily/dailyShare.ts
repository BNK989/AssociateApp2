import { MAX_STRIKES } from './dailyScoring';

/**
 * Turns a finished chain into something worth posting.
 *
 * The model is Wordle's grid, and the property that made it travel is that it
 * is **meaningless until you have played**. It shows how the day went without
 * showing a single answer -- or the theme, which is itself a spoiler, since
 * knowing the subject is most of the work.
 *
 * So nothing here emits a word, a hint, or a theme. Only shape.
 */

/** The first daily chain. Puzzle numbering counts from here. */
export const DAILY_EPOCH = '2025-12-28';

const MS_PER_DAY = 86_400_000;

export type ShareSquare = 'clean' | 'hinted' | 'missed';

/**
 * The grid alphabet.
 *
 * CLAUDE.md §3 bans emoji from component code; these fall under the same
 * exception as `CIPHER_SIGNS`. They are not decoration on a UI -- they are the
 * shared artefact itself, and they have to survive being pasted into a chat
 * app, which is exactly what an emoji does and an SVG icon cannot.
 */
const SQUARE_GLYPHS: Record<ShareSquare, string> = {
    clean: '\u{1F7E9}',   // green: solved with no hints
    hinted: '\u{1F7E8}',  // yellow: solved, but took a hint
    missed: '⬜',     // white: never solved
};

/** The parts of a board message this module needs; deliberately not the whole Message. */
export type ChainEntry = {
    is_solved?: boolean | null;
    hint_level?: number | null;
    strikes?: number | null;
    winner_points?: number | null;
};

function toUtcDays(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** Which puzzle this is, counting the first ever chain as #1. */
export function dailyPuzzleNumber(playDate: string): number {
    return toUtcDays(playDate) - toUtcDays(DAILY_EPOCH) + 1;
}

/**
 * How one word ended up.
 *
 * `is_solved` is not the discriminator it sounds like -- it is set when a word
 * leaves the board, whether it was guessed, given up on, or struck out. Points
 * are what separate a real solve from a surrender, since a genuine solve always
 * scores something even after every hint.
 */
export function squareFor(entry: ChainEntry): ShareSquare {
    // Struck out, gave up, or never reached -- all the same to a reader.
    if ((entry.strikes ?? 0) >= MAX_STRIKES) return 'missed';
    if ((entry.winner_points ?? 0) <= 0) return 'missed';

    return (entry.hint_level ?? 0) === 0 ? 'clean' : 'hinted';
}

/**
 * One square per word the player actually had to guess.
 *
 * The final entry is dropped: the last word of the chain is revealed for free
 * to start the game, so scoring it would credit everyone with a word they never
 * played.
 */
export function summarizeChain(entries: ChainEntry[]): ShareSquare[] {
    if (entries.length <= 1) return [];
    return entries.slice(0, -1).map(squareFor);
}

export function gridFor(squares: ShareSquare[]): string {
    return squares.map((square) => SQUARE_GLYPHS[square]).join('');
}

export function countSolved(squares: ShareSquare[]): number {
    return squares.filter((square) => square !== 'missed').length;
}

export type ShareTextArgs = {
    /** Already-translated headline line. */
    headline: string;
    squares: ShareSquare[];
    /** Already-translated streak line, when there is a streak worth showing. */
    streakLine?: string | null;
    url: string;
};

/**
 * Assembles the message.
 *
 * The grid sits on its own line so it survives clients that reflow text, and
 * the link is separated by a blank line so previews attach to it cleanly.
 */
export function buildShareText({ headline, squares, streakLine, url }: ShareTextArgs): string {
    const lines = [headline, gridFor(squares)];

    if (streakLine) lines.push(streakLine);

    lines.push('', url);

    return lines.join('\n');
}

/** A streak is only worth announcing once it is actually a streak. */
export const MIN_SHAREABLE_STREAK = 2;
