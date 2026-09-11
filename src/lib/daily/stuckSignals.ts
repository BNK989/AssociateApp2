import { MAX_HINT_LEVEL } from '@/lib/gameConfig';
import { solvesUntilBonus } from './streakRules';

/**
 * What the game says to a player who has gone quiet on a word.
 *
 * Everything else built for this problem is passive: the escape routes were
 * made less punishing, the aftermath kinder, the grid fairer. None of it
 * reaches a player who is sitting on a word, not typing, deciding whether to
 * close the tab — and that is the moment the whole effort was aimed at.
 *
 * The existing `useHintNudge` was meant to cover it and cannot: it only
 * animates the hint button, and it switches itself off while the auto-hint
 * clock is running, which in the daily game is always. So in practice nothing
 * has ever spoken to a stuck daily player.
 *
 * The design rule here is one line: **the game offers, the player never asks.**
 * A hint you request is an admission; the same hint arriving as an offer you
 * accept is the game being generous. Identical mechanics, opposite feeling, and
 * it is the cheapest psychological win available in the whole game.
 */

export type StuckOffer =
    /** No action — a reason to keep going. Shown first, and often alone. */
    | { kind: 'stake'; solvesToBonus: number; wordsLeft: number }
    /** Enter the chain from its first word and guess forward. */
    | { kind: 'other_end' }
    /** Take the next rung of the ladder, offered rather than requested. */
    | { kind: 'letter' }
    /** Show the word and move on. Last, and only once nothing else is left. */
    | { kind: 'reveal' };

export type StuckOfferKind = StuckOffer['kind'];

/**
 * Dwell time before the game says anything at all.
 *
 * Long enough that a player who is thinking productively is left alone —
 * interrupting someone mid-deduction to ask if they are stuck is its own kind
 * of insult — and short enough to arrive before the tab closes.
 */
export const FIRST_OFFER_MS = 14_000;

/** Dwell time before the offer escalates from a reason to a route. */
export const SECOND_OFFER_MS = 30_000;

/**
 * A wrong guess is worth this much dwell time.
 *
 * Someone who has guessed and missed is further into being stuck than someone
 * who has merely been quiet, and should reach the useful offers sooner.
 */
export const STRIKE_WORTH_MS = 12_000;

export type StuckInput = {
    /** Active time on the current word. */
    msOnWord: number;
    strikes: number;
    hintLevel: number;
    /** Whether the chain can still be entered from its first word. */
    canOpenOtherEnd: boolean;
    /** Solves in a row, for working out how close the bonus is. */
    consecutive: number;
    /** Guessable words still in play, including this one. */
    wordsLeft: number;
    /** Set once the player waves an offer away, so it is not re-offered. */
    dismissed: boolean;
};

/** Dwell time plus credit for wrong guesses. */
function pressure({ msOnWord, strikes }: StuckInput): number {
    return msOnWord + strikes * STRIKE_WORTH_MS;
}

/**
 * The offer to make, or null for silence.
 *
 * Silence is the common case and deliberately so. An offer that appears on
 * every word stops being read by the third one, which is precisely when a
 * player most needs to notice it.
 *
 * The order escalates from cheapest to most expensive, and each rung is skipped
 * when it has nothing to give: no point offering a route into the chain's other
 * end once it is open, or a letter once the ladder is spent.
 */
export function stuckOffer(input: StuckInput): StuckOffer | null {
    if (input.dismissed) return null;

    const elapsed = pressure(input);
    if (elapsed < FIRST_OFFER_MS) return null;

    if (elapsed < SECOND_OFFER_MS) {
        return {
            kind: 'stake',
            solvesToBonus: solvesUntilBonus(input.consecutive),
            wordsLeft: input.wordsLeft,
        };
    }

    if (input.canOpenOtherEnd) return { kind: 'other_end' };
    if (input.hintLevel < MAX_HINT_LEVEL) return { kind: 'letter' };

    return { kind: 'reveal' };
}
