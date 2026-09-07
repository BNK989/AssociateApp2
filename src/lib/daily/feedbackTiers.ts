import { calculateMessageValue } from '@/lib/gameLogic';
import { STREAK_BONUS_AT } from '@/lib/gameConfig';

/**
 * How well a word was solved, which is what the reward feedback is scaled to.
 *
 * Deliberately derived from the *ratio* of points kept rather than the raw
 * points. A word's base value is `10 + its length`, so raw points mostly
 * measure how long the word happened to be — celebrating a twelve-letter word
 * harder than a four-letter one rewards the puzzle, not the player. The ratio
 * measures the only thing the player controlled: how much of the word's value
 * they held on to.
 */
export type SolveTier = 'assisted' | 'solid' | 'clean';

/** Ascending order, so a tier can be compared against a threshold. */
export const SOLVE_TIERS: readonly SolveTier[] = ['assisted', 'solid', 'clean'] as const;

/**
 * Below this fraction of the word's untouched value the solve reads as
 * assisted. The level-3 clue costs 40% on its own, so anyone who took it lands
 * here; the two cheaper tiers together cost 20% and do not.
 */
const ASSISTED_BELOW = 0.5;

/** At or above this fraction the player gave nothing away. */
const CLEAN_AT = 0.95;

/**
 * Highest streak step the feedback escalates to.
 *
 * The chime climbs a pentatonic ladder as a streak runs, and it has to stop
 * climbing: an unbounded transposition ends up somewhere shrill, and a reward
 * that keeps rising forever stops reading as a reward at all.
 */
export const MAX_STREAK_STEP = 5;

/** Baseline intensity per tier, before any streak escalation. */
const TIER_INTENSITY: Record<SolveTier, number> = {
    assisted: 0.3,
    solid: 0.6,
    clean: 0.85,
};

/** How much each streak step adds to intensity. */
const STREAK_INTENSITY_STEP = 0.03;

export type SolveFeedback = {
    tier: SolveTier;
    /**
     * 0 while no streak bonus is running, then 1 upward — capped at
     * `MAX_STREAK_STEP`. This is the ladder rung, not the streak length.
     */
    streakStep: number;
    /** 0–1 blend both the chime and the flourish scale themselves by. */
    intensity: number;
};

/** What a word is worth solved cleanly: no hints taken, no streak applied. */
export function maxSolvePoints(word: string): number {
    return calculateMessageValue(word);
}

/**
 * Which rung of the streak ladder a run of `consecutive` solves has reached.
 *
 * Nothing happens below `STREAK_BONUS_AT`, so the escalation lines up with the
 * point at which the score multiplier actually kicks in — the player hears the
 * bonus start at the same moment they start earning it.
 */
export function streakStepFor(consecutive: number): number {
    if (!Number.isFinite(consecutive) || consecutive < STREAK_BONUS_AT) return 0;
    return Math.min(Math.floor(consecutive) - STREAK_BONUS_AT + 1, MAX_STREAK_STEP);
}

/** True when `tier` is at least as good as `threshold`. */
export function tierAtLeast(tier: SolveTier, threshold: SolveTier): boolean {
    return SOLVE_TIERS.indexOf(tier) >= SOLVE_TIERS.indexOf(threshold);
}

type SolveFeedbackArgs = {
    /** The word that was solved, which sets the ceiling it is measured against. */
    word: string;
    /** Points actually awarded, streak multiplier included. */
    points: number;
    /** Solves in a row, counted *after* this one. */
    consecutive: number;
};

/**
 * Grades a solve and returns everything the sound and the visuals need.
 *
 * Never throws and never returns a partial value: a zero-value word (the free
 * starting word is solved for 0) grades as `assisted`, which is the quietest
 * feedback, rather than dividing by zero.
 */
export function solveFeedback({ word, points, consecutive }: SolveFeedbackArgs): SolveFeedback {
    const max = maxSolvePoints(word);
    const ratio = max > 0 ? points / max : 0;

    let tier: SolveTier = 'solid';
    if (ratio < ASSISTED_BELOW) tier = 'assisted';
    else if (ratio >= CLEAN_AT) tier = 'clean';

    const streakStep = streakStepFor(consecutive);
    const intensity = Math.min(1, TIER_INTENSITY[tier] + streakStep * STREAK_INTENSITY_STEP);

    return { tier, streakStep, intensity };
}

/**
 * The transient "a word was just solved" payload, as the chat renders it.
 *
 * `feedback` is optional because classic multiplayer does not grade solves: it
 * has no per-player hint level to measure a ratio against. An ungraded solve
 * renders at the `solid` tier, which is exactly the flourish classic had before
 * grading existed.
 */
export type JustSolved = {
    id: string;
    points: number;
    feedback?: SolveFeedback;
};

/** The grade an ungraded solve is shown at. */
export const UNGRADED_FEEDBACK: SolveFeedback = {
    tier: 'solid',
    streakStep: 0,
    intensity: TIER_INTENSITY.solid,
};
