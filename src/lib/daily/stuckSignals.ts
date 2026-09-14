import { MAX_HINT_LEVEL } from '@/lib/gameConfig';
import { solvesUntilBonus } from './streakRules';

/** What each fork of the level-2 choice costs, in points. */
export type ChoicePrices = { clue: number; place: number };

/**
 * Prices the two forks of the choice at the game master's rates, from a word's
 * base value. Rounded up the way `calculateSolvePoints` rounds its deduction,
 * so the offer quotes what the scoreboard will actually take.
 */
export function choicePrices(
    wordValue: number,
    rates: { clueCost: number; costPerLetter: number },
): ChoicePrices {
    return {
        clue: Math.ceil(wordValue * rates.clueCost),
        place: Math.ceil(wordValue * rates.costPerLetter),
    };
}

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
    /**
     * Enter the chain from its first word and guess forward.
     *
     * A lateral move, not a rung: it hands the player a different word rather
     * than help with this one. It used to be offered first, on the grounds that
     * it gives nothing about this word away — and read, at the second offer, as
     * "skip this" put to a player who had not yet been offered a single letter.
     * So it now waits below the ladder: help with the word in front of them
     * first, a way off it only once that help is spent.
     */
    | { kind: 'other_end' }
    /** Take the next rung of the ladder, offered rather than requested. */
    | { kind: 'letter' }
    /**
     * The fork at hint level 2: the written clue, or the loose letters walking
     * into place. The player picks.
     *
     * Order only. Both are still there afterwards, and both were reachable from
     * the composer without it. What the fork adds is the asking: a player handed
     * a decision between two kinds of help is being consulted, where the same
     * two buttons in the header are waiting to be given in to. It exists at
     * this one rung because it is the only rung where the two remaining kinds
     * of help differ in kind — a sentence about the word, or its shape.
     */
    | { kind: 'choice'; lettersLeft: number }
    /**
     * Let the found letters walk into place, one at a time.
     *
     * The rung the ladder was missing. Everything above it hands over more
     * *letters*; this hands over their *positions*, which is the one thing hint
     * level 2 deliberately took away when it turned the mask into an anagram.
     * So it is not a cheaper grade of the hints before it — it is the only
     * offer left that can still end in the player solving the word themselves.
     */
    | { kind: 'settle'; lettersLeft: number }
    /** Show the word and move on. Last, and only once nothing else is left. */
    | { kind: 'reveal' };

export type StuckOfferKind = StuckOffer['kind'];

/**
 * What a tap on an offer does.
 *
 * Most offers carry one action, named by their kind. The `choice` offer carries
 * two, so its actions have names of their own: `clue` is the ladder's third
 * rung, `place` starts the settle drip.
 */
export type StuckAction = Exclude<StuckOfferKind, 'stake' | 'choice'> | 'clue' | 'place';

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
    /**
     * Whether the settle drip has a letter left to place on this word.
     *
     * Decided by `settleRules`, not here: the offer must never appear with
     * nothing behind it, and the question of what may settle is the drip's to
     * answer. False collapses the rung and the ladder falls through to the
     * reveal exactly as it did before this existed.
     */
    canSettle: boolean;
    /** Letters the drip may still place, for the settle offer's own copy. */
    settleLettersLeft: number;
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
 *
 * `other_end` is not a rung and does not sit among them. Everything on the
 * ladder addresses the word the player is actually looking at; the way off it
 * is offered only once the ladder is spent, and ahead of the reveal because a
 * word they can still come at from the far side beats retiring it unsolved.
 *
 * `settle` sits second-to-last on purpose. It is the most expensive offer that
 * still ends in a solve, so it must be exhausted before the reveal — which
 * ends in no solve at all — is ever put to the player.
 *
 * `choice` is the one place the ladder forks. One rung short of the clue, with
 * letters loose in the pool, the two kinds of help left are different in kind,
 * so the player is asked which they want rather than handed the next rung.
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

    if (input.hintLevel === MAX_HINT_LEVEL - 1 && input.canSettle) {
        return { kind: 'choice', lettersLeft: input.settleLettersLeft };
    }
    if (input.hintLevel < MAX_HINT_LEVEL) return { kind: 'letter' };
    if (input.canSettle) return { kind: 'settle', lettersLeft: input.settleLettersLeft };

    // The way off the word, once every kind of help with it is spent. Ahead of
    // the reveal: a word the player can still come at from the far side beats
    // retiring it unsolved.
    if (input.canOpenOtherEnd) return { kind: 'other_end' };

    return { kind: 'reveal' };
}
