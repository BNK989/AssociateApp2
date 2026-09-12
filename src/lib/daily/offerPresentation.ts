import type { StuckOfferKind } from './stuckSignals';

/**
 * How long an encouragement stays on screen, and what it leaves behind.
 *
 * Every offer used to behave the same way: appear above the composer and stay
 * there until the word changed or the player pushed it away. That is right for
 * one of them and wrong for the rest. "Three words left in the chain" is a
 * remark — it is read once and has nothing for the player to do, so a bar that
 * sits over the board for the next two minutes turns a small kindness into
 * clutter. "Stuck on this one?" is the opposite: it carries a way out, and a
 * player who was mid-thought when it appeared should still be able to take it
 * up thirty seconds later.
 *
 * So the two are split by whether there is anything to act on:
 *
 * - **transient** — nothing to do with it. Shows, holds long enough to be read,
 *   and fades. The progress cues in `progressCues.ts` already work this way.
 * - **collapsing** — carries an action. Holds, then shrinks to a chip parked at
 *   the inline-end edge instead of disappearing, so the route out stays one tap
 *   away without standing over the board.
 */

/** What an offer does once its time on screen is up. */
export type OfferPresentation = 'transient' | 'collapsing';

/**
 * Where an offer is in that life.
 *
 * `gone` is not the same as no offer at all: the underlying offer is still the
 * one the game would make, it has simply said its piece. It matters because the
 * offer escalates on the same word — a stake that has faded is replaced by a
 * route out a few seconds later, and that arrives expanded.
 */
export type OfferPhase = 'expanded' | 'collapsed' | 'gone';

/**
 * Read time for a remark, in the middle of a word.
 *
 * A player mid-guess is not looking at it when it lands, so this is measured
 * for someone who glances over a beat late rather than for someone reading it
 * from the first frame. Longer than the progress toasts (3.5s) for that reason.
 */
export const TRANSIENT_HOLD_MS = 5000;

/**
 * How long an actionable offer stands at full width before stepping aside.
 *
 * Long enough to finish the thought that was interrupted, short enough that the
 * board is not covered while the player works. The offer is not lost at the end
 * of it — it collapses rather than closes.
 */
export const COLLAPSE_AFTER_MS = 9000;

/** Offers with nothing to act on. Everything else carries a button. */
const TRANSIENT_KINDS: readonly StuckOfferKind[] = ['stake'];

export function presentationFor(kind: StuckOfferKind): OfferPresentation {
    return TRANSIENT_KINDS.includes(kind) ? 'transient' : 'collapsing';
}

/** Time at full width before the phase turns over. */
export function holdMsFor(kind: StuckOfferKind): number {
    return presentationFor(kind) === 'transient' ? TRANSIENT_HOLD_MS : COLLAPSE_AFTER_MS;
}

/** What the offer becomes when the hold runs out. */
export function phaseAfterHold(kind: StuckOfferKind): OfferPhase {
    return presentationFor(kind) === 'transient' ? 'gone' : 'collapsed';
}
