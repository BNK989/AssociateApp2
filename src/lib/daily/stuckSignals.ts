import { MAX_HINT_LEVEL, SETTLE } from '@/lib/gameConfig';
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
     * The rung where the ladder asks instead of handing over: by default hint
     * level 2, the written clue or the loose letters walking into place, with
     * the player picking. `options` is what the game master composed.
     *
     * Order only. Both are still there afterwards, and both were reachable from
     * the composer without it. What the fork adds is the asking: a player handed
     * a decision between two kinds of help is being consulted, where the same
     * two buttons in the header are waiting to be given in to. It sits one rung
     * short of the clue by default because that is the only rung where the two
     * remaining kinds of help differ in kind — a sentence about the word, or
     * its shape — but the rung and the row are the game master's to set.
     */
    | { kind: 'choice'; lettersLeft: number; options: readonly ChoiceOption[] }
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
 * What the fork may put in front of the player.
 *
 * Every one of them is a move the ladder makes anyway: `clue` is its next rung,
 * `place` starts the drip, `other_end` is the way off the word and `reveal`
 * ends it. The fork invents nothing — it only decides which of them arrive
 * together, and in what order.
 */
export type ChoiceOption = Extract<StuckAction, 'clue' | 'place' | 'other_end' | 'reveal'>;

export const CHOICE_OPTIONS: readonly ChoiceOption[] = [
    'clue',
    'place',
    'other_end',
    'reveal',
] as const;

/**
 * Where the ladder forks, and into what.
 *
 * `atHintLevel` is the one rung the fork stands in for; `null` is a game master
 * switching the fork off, and the ladder then runs straight through as it did
 * before the fork existed. `options` is the row of buttons in the order the
 * game master put them in.
 *
 * The compiled default is the fork as shipped: the clue or the drip, one rung
 * short of the clue. It reaches the board through the settle policy, the way
 * the clock above does.
 */
export type ChoiceFork = {
    atHintLevel: number | null;
    options: readonly ChoiceOption[];
};

export const DEFAULT_CHOICE_FORK: ChoiceFork = {
    atHintLevel: MAX_HINT_LEVEL - 1,
    options: ['clue', 'place'],
};

/**
 * A choice of one is not a choice — it is the rung it replaced, wearing a
 * question mark. Below this the fork stands aside and the ladder resumes.
 */
export const MIN_CHOICE_OPTIONS = 2;

/**
 * The clock the offer runs on.
 *
 * The compiled defaults are `SETTLE.STUCK_*`, with the reasoning on each; a
 * game master tunes them at `/admin/game-settings`, and they reach the board
 * through the settle policy. The named constants stay exported for the copy
 * and the tests that quote them.
 */
export type StuckTiming = {
    /** Dwell before the game says anything at all. */
    firstOfferMs: number;
    /** Dwell before the offer escalates from a reason to a route. */
    secondOfferMs: number;
    /** What a wrong guess is worth in dwell. */
    strikeWorthMs: number;
};

export const FIRST_OFFER_MS = SETTLE.STUCK_FIRST_OFFER_MS;
export const SECOND_OFFER_MS = SETTLE.STUCK_SECOND_OFFER_MS;
export const STRIKE_WORTH_MS = SETTLE.STUCK_STRIKE_WORTH_MS;

export const DEFAULT_STUCK_TIMING: StuckTiming = {
    firstOfferMs: FIRST_OFFER_MS,
    secondOfferMs: SECOND_OFFER_MS,
    strikeWorthMs: STRIKE_WORTH_MS,
};

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
    /** The game master's clock. Absent, the compiled defaults. */
    timing?: StuckTiming;
    /** The game master's fork. Absent, the compiled default. */
    choice?: ChoiceFork;
};

/** Dwell time plus credit for wrong guesses. */
function pressure({ msOnWord, strikes }: StuckInput, timing: StuckTiming): number {
    return msOnWord + strikes * timing.strikeWorthMs;
}

/**
 * The forks that have something behind them, in the game master's order.
 *
 * Same rule the ladder itself follows: an offer must never appear with nothing
 * wired to it. A clue with no rung left, letters with nothing to place and a
 * chain already open from both ends are all dropped here, before the player is
 * asked to pick between them. The reveal is always available, which is exactly
 * why it sits at the bottom of the ladder rather than anywhere near the top.
 */
function liveOptions(input: StuckInput, fork: ChoiceFork): ChoiceOption[] {
    return fork.options.filter((option) => {
        if (option === 'clue') return input.hintLevel < MAX_HINT_LEVEL;
        if (option === 'place') return input.canSettle;
        if (option === 'other_end') return input.canOpenOtherEnd;
        return true;
    });
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
 * `choice` is the one place the ladder forks, and the one place a game master
 * composes rather than tunes: which rung forks, and which of the moves below it
 * arrive side by side. The shipped default forks one rung short of the clue,
 * where the two kinds of help left differ in kind — a sentence about the word,
 * or its shape — so the player is asked which they want rather than handed the
 * next rung. A fork with fewer than two live options stands aside; the ladder
 * below it is unchanged and remains the fallback for everything the fork skips.
 */
export function stuckOffer(input: StuckInput): StuckOffer | null {
    if (input.dismissed) return null;

    const timing = input.timing ?? DEFAULT_STUCK_TIMING;
    const elapsed = pressure(input, timing);
    if (elapsed < timing.firstOfferMs) return null;

    if (elapsed < timing.secondOfferMs) {
        return {
            kind: 'stake',
            solvesToBonus: solvesUntilBonus(input.consecutive),
            wordsLeft: input.wordsLeft,
        };
    }

    const fork = input.choice ?? DEFAULT_CHOICE_FORK;
    if (fork.atHintLevel !== null && input.hintLevel === fork.atHintLevel) {
        const options = liveOptions(input, fork);
        if (options.length >= MIN_CHOICE_OPTIONS) {
            return { kind: 'choice', lettersLeft: input.settleLettersLeft, options };
        }
    }
    if (input.hintLevel < MAX_HINT_LEVEL) return { kind: 'letter' };
    if (input.canSettle) return { kind: 'settle', lettersLeft: input.settleLettersLeft };

    // The way off the word, once every kind of help with it is spent. Ahead of
    // the reveal: a word the player can still come at from the far side beats
    // retiring it unsolved.
    if (input.canOpenOtherEnd) return { kind: 'other_end' };

    return { kind: 'reveal' };
}
