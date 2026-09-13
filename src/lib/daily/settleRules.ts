import {
    knownUnplacedIndices,
    seedFromId,
    type MaskState,
} from '@/lib/letterPool/poolRules';
import { typeableCapacity } from '@/lib/letterPool/slotRules';
import type { SettleOrder, SettlePolicy } from './settlePolicy';

/**
 * Which letter the settle drip places next, and when it must stop.
 *
 * Pure and tested for the same reason `cipherRules` and `poolRules` are: this
 * decides what the player is allowed to see, and that must not be tangled up
 * with a timer. The hook above it owns *when*; everything about *what* is here.
 *
 * The one rule the whole mechanic rests on:
 *
 * > **The drip places letters the player already has. It never reveals a new
 * > one.** A settled letter comes out of the pool, where the player could
 * > already read it. What they are given is its position, which is the one
 * > thing hint level 2 took away.
 *
 * That is what makes it a distinct rung rather than a cheaper hint, and it is
 * also why it self-gates: with an empty pool there is nothing to place, so the
 * drip cannot fire before the player has been given something to work with.
 */

/**
 * English letters commonest first.
 *
 * Only the *order* matters, not the frequencies, so a plain string is the
 * honest data structure. Used by `rare-first`, on the reasoning that a settled
 * Q narrows the answer far more than a settled E does — the same letter costs
 * the player the same points either way, so the order decides what they get
 * for it.
 *
 * Non-Latin answers fall off the end of this and all rank equal, which degrades
 * `rare-first` to the seeded order rather than to text order. Deliberate: text
 * order is the one arrangement that must never leak.
 */
const BY_FREQUENCY = 'etaoinshrdlcumwfgypbvkjxqz';

export type SettleState = {
    text: string;
    guesses: string[];
    mask?: MaskState;
    /** Indices already settled, as stored on the message. */
    settled: readonly number[];
    policy: SettlePolicy;
};

/**
 * The most letters that may ever settle on this word.
 *
 * Two independent floors, because neither subsumes the other: `maxFraction`
 * scales with the word and `minUnsettled` does not. Half of an eleven-letter
 * word leaves five for the player; half of a four-letter word leaves two, and
 * on a three-letter word it would leave one. The absolute floor is what stops
 * the drip from solving short words outright.
 *
 * Counted against *typeable* length, not string length, so the spaces and
 * apostrophes the strip supplies for free never inflate the allowance.
 */
export function settleAllowance(text: string, policy: SettlePolicy): number {
    const typeable = typeableCapacity(text);
    const byFraction = Math.floor(typeable * policy.maxFraction);
    const byFloor = typeable - policy.minUnsettled;

    return Math.max(0, Math.min(byFraction, byFloor));
}

/**
 * Candidate positions in the order the policy wants them placed.
 *
 * Never text order unless the policy explicitly asks for it. `left-to-right` is
 * the one reading that hands the player the word's opening, which is both the
 * strongest hint per letter and the fastest way to spend the allowance — it is
 * offered because it is the most legible choice to a game master, not because
 * it is the best one.
 *
 * `seeded` keys off the answer itself rather than off the index, for the reason
 * `scramblePool` documents at length: a permutation seeded on position alone is
 * the same permutation for every word of that length, and a player who learns
 * it once can invert it forever.
 */
export function orderCandidates(
    text: string,
    candidates: readonly number[],
    order: SettleOrder,
): number[] {
    if (order === 'left-to-right') return [...candidates];

    const chars = [...text];
    const seedOf = (index: number) => seedFromId(`${text}:${index}`);

    if (order === 'seeded') {
        return [...candidates].sort((a, b) => seedOf(a) - seedOf(b) || a - b);
    }

    // Rarest first. An unranked character (any non-Latin answer) sorts as
    // maximally common, so those words fall back to the seeded order rather
    // than to text order.
    const rank = (index: number) => {
        const at = BY_FREQUENCY.indexOf(chars[index]?.toLowerCase() ?? '');
        return at === -1 ? -1 : at;
    };

    return [...candidates].sort(
        (a, b) => rank(b) - rank(a) || seedOf(a) - seedOf(b) || a - b,
    );
}

/**
 * Positions that could still settle, in policy order.
 *
 * Read straight from `knownUnplacedIndices` — the same function that builds the
 * pool — so "what is hanging around the word" and "what may be placed" cannot
 * disagree. Already-settled positions are excluded by that call, since a
 * settled letter counts as placed.
 */
export function settleCandidates({ text, guesses, mask, settled, policy }: SettleState): number[] {
    const candidates = knownUnplacedIndices(text, guesses, mask, new Set(settled));
    return orderCandidates(text, candidates, policy.order);
}

/**
 * The next position to settle, or null when there is nothing to give.
 *
 * Null for three different reasons, all of which mean the same thing to the
 * caller: the allowance is spent, the pool is empty, or the mode is off. The
 * stuck ladder reads this to decide whether the rung exists at all, so the
 * offer can never appear with nothing behind it.
 */
export function nextSettleIndex(state: SettleState): number | null {
    if (state.policy.mode === 'off') return null;
    if (state.settled.length >= settleAllowance(state.text, state.policy)) return null;

    return settleCandidates(state)[0] ?? null;
}

/** Whether the drip has anything left to place on this word. */
export function canSettle(state: SettleState): boolean {
    return nextSettleIndex(state) !== null;
}

/**
 * Whether the word is far enough up the ladder for the drip to exist.
 *
 * Separate from `canSettle` because they fail for different reasons and the
 * caller needs to tell them apart: a word below the arming level may well have
 * candidates, and offering on it would turn the last rung into a shortcut past
 * the ladder.
 */
export function settleArmed(hintLevel: number, policy: SettlePolicy): boolean {
    return policy.mode !== 'off' && hintLevel >= policy.armFromHintLevel;
}

/**
 * Dwell, plus credit for wrong guesses — the same currency the stuck offer
 * spends, so the two escalations cannot get out of step.
 */
export function settlePressure(
    { msOnWord, strikes }: { msOnWord: number; strikes: number },
    policy: SettlePolicy,
): number {
    return msOnWord + strikes * policy.strikeCreditMs;
}

/**
 * How many letters `auto` mode should have placed by now.
 *
 * Derived from elapsed pressure rather than counted up by a timer, so a
 * backgrounded tab, a re-mount or a restored save all converge on the same
 * answer instead of drifting apart. The caller settles letters one at a time
 * until its count reaches this, which keeps each placement its own animated
 * event even when several are owed at once.
 */
export function settlesDueBy(pressureMs: number, policy: SettlePolicy): number {
    if (pressureMs < policy.firstDelayMs) return 0;
    return 1 + Math.floor((pressureMs - policy.firstDelayMs) / policy.intervalMs);
}
