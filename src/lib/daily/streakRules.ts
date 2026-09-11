import { STREAK_BONUS_AT } from '@/lib/gameConfig';

/**
 * What a move does to the in-chain solve streak.
 *
 * The streak used to be a cliff. Any wrong guess zeroed it — not a lost word, a
 * single wrong *guess*, so a player five solves deep who mistyped once and then
 * solved the word anyway came out of it on one. Revealing a word zeroed it
 * again on top of the points already forfeited, which is the same failure
 * charged twice.
 *
 * A cliff is the wrong shape for a number whose only job is to keep someone
 * playing: losing everything at once is the moment a run stops feeling worth
 * protecting, and the player who most needs a reason to carry on is the one it
 * fires on. So the streak decays instead. One unsolved word costs one step, and
 * a player on five who reveals a word is still on four — near enough to the
 * bonus to be worth reaching for, which a zero never is.
 *
 * Wrong guesses cost nothing here at all. The word carries its own strikes;
 * charging the streak for them as well was double counting.
 */

/** Solves in a row needed for the bonus multiplier. Re-exported for callers. */
export { STREAK_BONUS_AT };

/** A solve extends the run. */
export function streakAfterSolve(consecutive: number): number {
    return consecutive + 1;
}

/**
 * A word that left the board unsolved — revealed or struck out — costs one step.
 *
 * Deliberately the same rule for both. A player who chose to look at a word and
 * a player who ran out of guesses on it are in the same position, and grading
 * one of them harder only teaches the other route.
 */
export function streakAfterUnsolved(consecutive: number): number {
    return Math.max(0, consecutive - 1);
}

/** Whether a solve at this streak earns the multiplier. */
export function earnsStreakBonus(consecutive: number): boolean {
    return consecutive >= STREAK_BONUS_AT;
}

/**
 * Solves still needed for the bonus, or 0 once it is live.
 *
 * The cue that tells a player how close they are reads this, so the number on
 * screen and the number scoring uses cannot drift apart.
 */
export function solvesUntilBonus(consecutive: number): number {
    return Math.max(0, STREAK_BONUS_AT - consecutive);
}
