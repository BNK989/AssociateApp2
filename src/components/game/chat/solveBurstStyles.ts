import type { SolveTier } from '@/lib/daily/feedbackTiers';

/**
 * The visual grammar of a solve flourish, as pure data.
 *
 * Separated from the component so the scaling can be tested without rendering,
 * and so the one place that decides "how big is this reward" is readable in
 * isolation. The rule it encodes: **the flourish is sized to the achievement,
 * not to the number**. A long word is not a better solve.
 */

export type BurstVisual = {
    /** Tailwind classes for the "+N" itself. */
    numberClass: string;
    /** Soft halo behind the number. Empty when the tier does not earn one. */
    glowClass: string;
    /** Tailwind classes for a spark particle. */
    sparkClass: string;
    /** How many sparks to emit. Zero means none. */
    sparkCount: number;
    /** Multiplier on the number's size, 1 being the baseline. */
    scale: number;
    /** How far, in pixels, the number travels before it fades. */
    rise: number;
};

/** Per-tier look. Paired light/dark palette classes, as elsewhere in the chat. */
const TIER_STYLE: Record<SolveTier, Pick<BurstVisual, 'numberClass' | 'glowClass' | 'sparkClass'>> = {
    // Deliberately quiet and deliberately not green: the AI clue did the work,
    // and dressing that up the same as an unaided solve devalues the unaided one.
    assisted: {
        numberClass: 'text-slate-400 dark:text-slate-500',
        glowClass: '',
        sparkClass: 'bg-slate-400/70 dark:bg-slate-500/70',
    },
    solid: {
        numberClass: 'text-emerald-500 dark:text-emerald-400',
        glowClass: 'bg-emerald-400/25 dark:bg-emerald-400/20',
        sparkClass: 'bg-emerald-400 dark:bg-emerald-300',
    },
    // Gold, and the only tier that gets one. Scarcity is what makes it read as
    // special — a colour every solve earns is just the colour of solving.
    clean: {
        numberClass: 'text-amber-500 dark:text-amber-300',
        glowClass: 'bg-amber-400/30 dark:bg-amber-300/25',
        sparkClass: 'bg-amber-400 dark:bg-amber-300',
    },
};

/** Sparks a tier emits at full flourish, before the streak bonus. */
const TIER_SPARKS: Record<SolveTier, number> = { assisted: 0, solid: 6, clean: 10 };

/** Extra sparks per streak rung. */
const SPARKS_PER_STREAK_STEP = 1;

/** Ceiling on sparks. Past this it reads as noise, and costs frames to animate. */
const MAX_SPARKS = 14;

/** Baseline travel in pixels, at flourish 1. */
const BASE_RISE = 40;

type BurstVisualArgs = {
    tier: SolveTier;
    /** 0–1 grade of the solve, from `solveFeedback`. */
    intensity: number;
    /** Game master's 0–1 scale on every flourish. */
    flourish: number;
    /** Streak rung, which adds sparks rather than changing the colour. */
    streakStep: number;
    /** False when the policy's burst threshold excludes this tier. */
    withSparks: boolean;
};

/**
 * Turns a graded solve into the numbers the flourish renders with.
 *
 * `flourish` scales size and travel but never drives them to nothing: at
 * flourish 0 the number still appears at its baseline size and simply does not
 * move or spark. A game master turning the celebration down should get a
 * calmer game, not a broken one where scoring stops being visible.
 */
export function burstVisual({
    tier,
    intensity,
    flourish,
    streakStep,
    withSparks,
}: BurstVisualArgs): BurstVisual {
    const scaled = Math.max(0, Math.min(1, flourish));

    const sparkCount = withSparks
        ? Math.min(
            MAX_SPARKS,
            Math.round((TIER_SPARKS[tier] + streakStep * SPARKS_PER_STREAK_STEP) * scaled),
        )
        : 0;

    return {
        ...TIER_STYLE[tier],
        sparkCount,
        scale: 1 + intensity * 0.45 * scaled,
        rise: BASE_RISE * (0.5 + 0.5 * scaled),
    };
}

/**
 * The ring a bubble wears for the moment it is solved.
 *
 * Tiered for the same reason the number is: the ring used to be green whatever
 * happened, so the board looked identical for a word the player cracked unaided
 * and one the AI clue handed them.
 */
const TIER_RING: Record<SolveTier, string> = {
    assisted: 'scale-105 ring-2 ring-slate-400/70 dark:ring-slate-500/70',
    solid: 'scale-110 ring-2 ring-emerald-500 dark:ring-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]',
    clean: 'scale-110 ring-2 ring-amber-400 dark:ring-amber-300 shadow-[0_0_22px_rgba(251,191,36,0.45)]',
};

export function solvedRingClass(tier: SolveTier): string {
    return TIER_RING[tier];
}
