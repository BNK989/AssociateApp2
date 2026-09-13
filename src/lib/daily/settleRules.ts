import {
    isGapChar,
    knownUnplacedIndices,
    placedIndices,
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
 * The rule the mechanic rested on, and what replaced it:
 *
 * > **The drip places letters the player already has. It never reveals a new
 * > one.** A settled letter comes out of the pool, where the player could
 * > already read it. What they are given is its position, which is the one
 * > thing hint level 2 took away.
 *
 * That was exactly right while level 2 was an anagram: the pool was full, and
 * position was the thing the player was short of. With `SCRAMBLE_MASK` off the
 * pool holds only what the player's own wrong guesses proved, which on a word
 * they have not guessed at is nothing — so the rule self-gated its way into
 * never firing, and the ladder fell from the clue straight to the Reveal.
 *
 * So the rule now has a level attached to it. Below `revealFromHintLevel` it
 * stands unchanged: positions only, out of the pool, nothing new. At and above
 * it the drip may also open a letter the player has not seen, because there the
 * only thing left to offer instead is the Reveal, which ends in no solve at all.
 * Pool letters are still spent first — the cheapest information the drip has —
 * and both ceilings bind throughout, so it can hand over at most half a word
 * and never the last two letters.
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
    /**
     * The word's hint level, carried explicitly rather than read off `mask`.
     *
     * The mask is optional and the level is not: `revealsUnseen` has to give the
     * same answer on a word whose `cipher_text` has not arrived yet as on one
     * where it has, or the rung would blink in and out with the mask.
     */
    hintLevel: number;
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
export function settleCandidates(
    { text, guesses, mask, settled, policy, hintLevel }: SettleState,
): number[] {
    const settledSet = new Set(settled);
    const known = knownUnplacedIndices(text, guesses, mask, settledSet);
    const fromPool = orderCandidates(text, known, policy.order);

    if (!revealsUnseen(hintLevel, policy)) return fromPool;

    // Pool first, always. A loose letter costs the player nothing they did not
    // already have — only its position — so every one of them is spent before
    // the drip opens a letter the word was still keeping from them.
    return [...fromPool, ...orderCandidates(text, unseenIndices({
        text, guesses, mask, settled: settledSet, known, hintLevel,
    }), policy.order)];
}

/**
 * Whether the drip may open a letter the player has not been shown.
 *
 * Its own predicate for the same reason `settleArmed` is: arming and having
 * something to give fail for different reasons, and this is a third question
 * again — *what kind* of thing the drip is allowed to give at this height on
 * the ladder.
 */
export function revealsUnseen(hintLevel: number, policy: SettlePolicy): boolean {
    return policy.revealFromHintLevel !== null && hintLevel >= policy.revealFromHintLevel;
}

/**
 * Positions the player has neither been shown nor found — the word's remaining
 * secrets, as indices.
 *
 * Deliberately derived by subtraction from the two sets that already exist
 * rather than by re-deriving what the player knows: `placedIndices` and
 * `knownUnplacedIndices` are what the line and the pool are drawn from, so
 * anything in neither is, by construction, a letter nothing on screen is
 * showing. A second reading of the mask here could disagree with the board, and
 * the failure would be the drip "revealing" a letter already in plain sight.
 */
function unseenIndices(
    { text, guesses, mask, settled, known, hintLevel }: {
        text: string;
        guesses: string[];
        mask?: MaskState;
        settled: ReadonlySet<number>;
        known: readonly number[];
        hintLevel: number;
    },
): number[] {
    const placed = placedIndices(text, guesses, mask, settled);
    const inPool = new Set(known);

    // Hint level 1 buys the first letter and it stays bought. `placedIndices`
    // says so too, but only once a mask has arrived to say it through — and
    // "the drip never hands back a letter the player already paid for" must not
    // depend on the timing of a `cipher_text`. Asked of the level directly, the
    // same way `readMaskTile` asks it of the answer.
    const firstIsBought = hintLevel >= 1;

    return [...text].flatMap((char, index) => (
        placed.has(index)
        || inPool.has(index)
        || isGapChar(char)
        || (firstIsBought && index === 0)
            ? []
            : [index]
    ));
}

/**
 * The next position to settle, or null when there is nothing to give.
 *
 * Null for three different reasons, all of which mean the same thing to the
 * caller: the allowance is spent, there is nothing left it may give, or the
 * mode is off. The
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

/**
 * Where the wait stands: how long until the next letter, and how far through.
 *
 * Exported so the composer can draw the countdown without re-deriving the
 * schedule. That matters more than saving a few lines — the ring and the letter
 * have to agree to the tick, or the player watches a ring hit zero and nothing
 * happen, which reads as the game stalling rather than as help arriving.
 *
 * The percentage counts *up* toward the next letter, so a full ring means one
 * is landing. The auto-hint ring drains instead, and the difference is
 * deliberate: that clock is the game taking something away from the score, this
 * one is the game bringing something. Same vocabulary, opposite direction.
 */
export function settleCountdown(
    pressureMs: number,
    policy: SettlePolicy,
    /** `offered` skips the first delay: the player has already been given one. */
    started: boolean,
): { msUntilNext: number; progressPercent: number } {
    const firstDelay = started ? 0 : policy.firstDelayMs;

    if (pressureMs < firstDelay) {
        return {
            msUntilNext: firstDelay - pressureMs,
            progressPercent: clampPercent((pressureMs / firstDelay) * 100),
        };
    }

    const since = (pressureMs - firstDelay) % policy.intervalMs;

    return {
        msUntilNext: policy.intervalMs - since,
        progressPercent: clampPercent((since / policy.intervalMs) * 100),
    };
}

function clampPercent(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
}
