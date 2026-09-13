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
    /**
     * Use the letters you are already holding.
     *
     * The cheapest rung there is, and the only one that costs nothing at all:
     * it asks the player to spend what the game has *already* given them. It
     * exists because the loose letters became tappable and nothing said so —
     * but it earns its place beyond discoverability, because it is the one
     * offer whose answer is "you can do this", not "here is more help".
     *
     * Deliberately in the early window only, ahead of everything priced. A
     * player with letters in hand is not stuck yet, and the first thing said to
     * them should not be an offer to do it for them.
     */
    | { kind: 'place'; lettersLeft: number }
    /** Enter the chain from its first word and guess forward. */
    | { kind: 'other_end' }
    /** Take the next rung of the ladder, offered rather than requested. */
    | { kind: 'letter' }
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
 * Dwell time after which the other end stops holding the escalation slot.
 *
 * `other_end` is a lateral move, not a rung: it hands the player a different
 * word rather than help with this one, and it is offered first only because it
 * gives nothing about this word away. That was harmless while the auto-hint
 * clock was handing out the ladder regardless — and a silent trap the moment it
 * was switched off, because a player who simply declines to leave the word
 * would sit on a repeating "other end" and never be offered a hint at all.
 *
 * So it gets one window rather than the slot. Past this the ladder continues to
 * the rungs that actually address the word in front of the player, and the
 * route to the other end survives below the ladder and on the hint menu.
 */
export const THIRD_OFFER_MS = 50_000;

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
    /**
     * Loose letters the player could place themselves right now.
     *
     * The halo's own chips. Zero means there is nothing to point at, and the
     * early window falls back to the stake.
     */
    looseLetters: number;
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
 * The one rung that does not hold its place is `other_end`, which gets a window
 * rather than the slot — see `THIRD_OFFER_MS`. Everything behind it addresses
 * the word the player is actually looking at, and a player who declines to
 * leave that word must still be able to reach them.
 *
 * `settle` sits second-to-last on purpose. It is the most expensive offer that
 * still ends in a solve, so it must be exhausted before the reveal — which
 * ends in no solve at all — is ever put to the player.
 */
export function stuckOffer(input: StuckInput): StuckOffer | null {
    if (input.dismissed) return null;

    const elapsed = pressure(input);
    if (elapsed < FIRST_OFFER_MS) return null;

    if (elapsed < SECOND_OFFER_MS) {
        // Their own letters before anything the game can hand over. A player
        // holding letters is not stuck, they are mid-thought, and the useful
        // thing to say is that the next move is already theirs to make.
        if (input.looseLetters > 0) {
            return { kind: 'place', lettersLeft: input.looseLetters };
        }

        return {
            kind: 'stake',
            solvesToBonus: solvesUntilBonus(input.consecutive),
            wordsLeft: input.wordsLeft,
        };
    }

    if (elapsed < THIRD_OFFER_MS && input.canOpenOtherEnd) return { kind: 'other_end' };

    if (input.hintLevel < MAX_HINT_LEVEL) return { kind: 'letter' };
    if (input.canSettle) return { kind: 'settle', lettersLeft: input.settleLettersLeft };

    // Back to the other end once the ladder is spent. A word the player can
    // still come at from the far side beats retiring it unsolved, so this sits
    // ahead of the reveal even though it was passed over further up.
    if (input.canOpenOtherEnd) return { kind: 'other_end' };

    return { kind: 'reveal' };
}
