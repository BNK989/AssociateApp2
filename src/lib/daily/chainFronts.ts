import { MAX_STRIKES } from '@/lib/gameConfig';

/**
 * Which word is in play, once the chain can be worked from both ends.
 *
 * The daily chain is strictly pairwise — the generator is told "each word
 * associates naturally with the one after it" — and play runs in one direction,
 * from the free final word backwards. That has one bad consequence: the only
 * thing a player can reason from is the word *after* the one they are guessing,
 * so a word they cannot get is a wall, not a detour. Skipping it would leave
 * the next word with no anchor at all, which is why parking a word and coming
 * back to it makes this game harder rather than kinder.
 *
 * The same prompt guarantees the way out: "every link must read in both
 * directions". So a stuck player can open the chain's **first** word instead —
 * the one word with no predecessor, and therefore the only other place a chain
 * can be entered. From there they guess *forwards* while the backward front
 * stays where it is, the two fronts converge, and the word they were stuck on
 * ends up squeezed between two neighbours they know.
 *
 * The cost is honest and paid once: one word given away, scored at nothing and
 * white on the grid, exactly like a reveal.
 */

type FrontMessage = {
    is_solved: boolean;
    strikes?: number | null;
};

/**
 * Words that can still be guessed, in chain order.
 *
 * Same predicate `findTargetMessage` uses, so the two cannot disagree about
 * what "still in play" means.
 */
export function wordsInPlay<T extends FrontMessage>(messages: T[]): T[] {
    return messages.filter((m) => !m.is_solved && (m.strikes || 0) < MAX_STRIKES);
}

/**
 * Whether the chain has been entered from its start.
 *
 * Derived from the board rather than stored beside it. In an ordinary game the
 * first word is solved *last* — it is the far end of a chain walked backwards —
 * so it being off the board while others remain can only mean it was opened
 * deliberately. Deriving it means the flag cannot drift out of step with the
 * board, and a restored save gets it for free.
 */
export function isOtherEndOpen<T extends FrontMessage>(messages: T[]): boolean {
    return Boolean(messages[0]?.is_solved);
}

/**
 * The word in play.
 *
 * Backwards from the end normally. Once the other end is open the forward front
 * takes over: it is the side with a freshly known neighbour to reason from,
 * while the backward front is parked against the word that caused the problem.
 * Play then closes the gap from the start until the two meet.
 */
export function findDailyTarget<T extends FrontMessage>(messages: T[]): T | undefined {
    const inPlay = wordsInPlay(messages);
    if (inPlay.length === 0) return undefined;

    return isOtherEndOpen(messages) ? inPlay[0] : inPlay[inPlay.length - 1];
}

/**
 * Words that must still be in play for opening the other end to be worth it.
 *
 * Below three, the word it would hand over is the one the player is stuck on or
 * its immediate neighbour, which makes it an expensive way to press Reveal.
 */
export const MIN_WORDS_TO_OPEN_OTHER_END = 3;

/** Whether the player can still enter the chain from its start. */
export function canOpenOtherEnd<T extends FrontMessage>(messages: T[]): boolean {
    if (messages.length === 0) return false;
    if (isOtherEndOpen(messages)) return false;

    return wordsInPlay(messages).length >= MIN_WORDS_TO_OPEN_OTHER_END;
}
