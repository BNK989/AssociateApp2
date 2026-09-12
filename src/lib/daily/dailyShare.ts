import { MAX_HINT_LEVEL, MAX_STRIKES } from './dailyScoring';

/**
 * Turns a finished chain into something worth posting.
 *
 * The model is Wordle's grid, and the property that made it travel is that it
 * is **meaningless until you have played**. It shows how the day went without
 * showing a single answer.
 *
 * So nothing here emits a word or a hint. Only shape -- plus, since
 * 2026-09-12, the day's theme, which is a deliberate exception argued in
 * `buildShareText` below.
 */

/** The first daily chain. Puzzle numbering counts from here. */
export const DAILY_EPOCH = '2025-12-28';

const MS_PER_DAY = 86_400_000;

export type ShareSquare = 'clean' | 'hard_won' | 'hinted' | 'missed';

/**
 * The grid alphabet.
 *
 * CLAUDE.md §3 bans emoji from component code; these fall under the same
 * exception as `CIPHER_SIGNS`. They are not decoration on a UI -- they are the
 * shared artefact itself, and they have to survive being pasted into a chat
 * app, which is exactly what an emoji does and an SVG icon cannot.
 */
const SQUARE_GLYPHS: Record<ShareSquare, string> = {
    clean: '\u{1F7E9}',    // green: solved outright
    hard_won: '\u{1F7E6}', // blue: solved after a fight
    hinted: '\u{1F7E8}',   // yellow: solved with the answer's clue in hand
    missed: '⬜',      // white: never solved
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
 * leaves the board, whether it was guessed, revealed, or struck out. Points are
 * what separate a real solve from a reveal, since a genuine solve always scores
 * something even after every hint.
 *
 * Two things changed once it became clear the grid was the strongest force in
 * the game pushing players away from hints.
 *
 * **Only the AI clue discolours a square.** A yellow square is the permanent,
 * public record of having needed help, and it used to be charged for the first
 * letter -- the smallest nudge in the game -- exactly as it was for the clue
 * that all but names the word. The ladder's cheap rungs are socially free now,
 * which is the only way the ladder means anything.
 *
 * **A fight gets its own colour.** A word solved after two wrong guesses is a
 * better story than one guessed first time, and reporting them as the same
 * green threw that away. Hints outrank strikes: a word whose clue you were
 * given is not one you won the hard way, however many attempts it took.
 */
export function squareFor(entry: ChainEntry): ShareSquare {
    // Struck out, revealed, or never reached -- all the same to a reader.
    if ((entry.strikes ?? 0) >= MAX_STRIKES) return 'missed';
    if ((entry.winner_points ?? 0) <= 0) return 'missed';

    if ((entry.hint_level ?? 0) >= MAX_HINT_LEVEL) return 'hinted';
    if ((entry.strikes ?? 0) > 0) return 'hard_won';

    return 'clean';
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

/** Separator between the parts of the result line. Spaced, so it reads in RTL too. */
export const SEGMENT_SEPARATOR = ' \u00B7 ';

/**
 * Joins the parts of a line, dropping the ones this day did not earn.
 *
 * The result line is assembled from independently translated fragments -- the
 * score, the streak -- so the spacing around the separator is decided here
 * rather than baked into seven locale files.
 */
export function joinSegments(segments: Array<string | null | undefined>): string {
    return segments.filter((segment): segment is string => Boolean(segment)).join(SEGMENT_SEPARATOR);
}

export type ShareTextArgs = {
    /** Already-translated first line: the puzzle number, and the day's theme when there is one. */
    headline: string;
    squares: ShareSquare[];
    /** Already-translated result line -- solved count, score, and the streak when there is one. */
    statsLine: string;
    /** Already-translated closing line, addressed to whoever reads the post. */
    ctaLine?: string | null;
    url: string;
};

/**
 * Assembles the message.
 *
 * The grid sits on its own line so it survives clients that reflow text, and
 * the link is separated by a blank line so previews attach to it cleanly.
 *
 * Order is doing work. The theme rides the headline, so the first thing a
 * reader sees is a subject rather than a serial number; the grid comes second
 * while it is still the most striking thing in the post; the numbers come
 * third, because they mean nothing to someone who has not played; and the
 * challenge lands last, next to the link it wants pressed.
 *
 * **On naming the theme.** This module used to refuse to, on the grounds that
 * knowing the subject is most of the work. That is true of the player who has
 * not started -- and the reader of a shared result is not that player. They are
 * someone being recruited, and a post that says only how well a stranger did at
 * something unnamed gives them no reason to care. The theme is the only part of
 * the day that is interesting before you play. A recipient still gets no word,
 * no clue and no chain order; what they get is a slightly easier first game,
 * which is the trade this makes on purpose. The grid alone stays spoiler-free
 * for anyone who wants it -- `gridFor` emits shape and nothing else.
 */
export function buildShareText({ headline, squares, statsLine, ctaLine, url }: ShareTextArgs): string {
    const lines = [headline, gridFor(squares), statsLine, ctaLine]
        .filter((line): line is string => Boolean(line));

    lines.push('', url);

    return lines.join('\n');
}

/** A streak is only worth announcing once it is actually a streak. */
export const MIN_SHAREABLE_STREAK = 2;
