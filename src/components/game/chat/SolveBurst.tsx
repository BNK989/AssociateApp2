import { motion, useReducedMotion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { STREAK_MULTIPLIER } from '@/lib/gameConfig';
import type { SolveTier } from '@/lib/daily/feedbackTiers';
import { burstVisual } from './solveBurstStyles';

/** Seconds the whole flourish is on screen. Must stay under `SOLVED_FLASH_MS`. */
const DURATION = 1.25;

/** Sparks travel this far, times the tier's rise. */
const SPARK_REACH = 1.6;

type SolveBurstProps = {
    points: number;
    tier: SolveTier;
    /** Streak rung; anything above 0 means the score multiplier is running. */
    streakStep: number;
    /** 0–1 grade of the solve, which sizes the number. */
    intensity: number;
    /** Game master's 0–1 scale on every flourish. */
    flourish: number;
    /** False when the policy's burst threshold excludes this tier. */
    withSparks: boolean;
};

/**
 * The flourish a correct guess throws off: a graded "+N", a spark burst, and a
 * streak chip when the multiplier is running.
 *
 * Replaces a fixed green "+N" that looked identical whether the player had
 * solved a word unaided on a five-solve streak or been handed the answer by the
 * AI clue. Uniform feedback for unequal achievements is the fastest way to make
 * a reward stop meaning anything, so everything here is scaled by
 * `solveFeedback`'s grade — the same grade the chime is built from, so the two
 * can never disagree.
 *
 * Reduced motion is honoured properly rather than by shortening the animation:
 * the number fades in place and the sparks are not rendered at all. A player who
 * has asked for less movement still gets the tier's colour, size and chip, so no
 * information is carried by motion alone.
 *
 * The flourish itself is `aria-hidden` — a "+18" floating past is decoration,
 * and the solved bubble already carries the outcome. The same information goes
 * out once, as one sentence, from a `role="status"` sibling.
 */
export function SolveBurst({
    points,
    tier,
    streakStep,
    intensity,
    flourish,
    withSparks,
}: SolveBurstProps) {
    const t = useTranslations('GameRoom.Chat');
    const reduced = Boolean(useReducedMotion());

    const visual = burstVisual({ tier, intensity, flourish, streakStep, withSparks });
    const onStreak = streakStep > 0;

    return (
        <>
            {/*
              * The announcement is a SIBLING of the flourish, not a child of
              * it. Nesting it inside the aria-hidden wrapper hid it from the
              * screen readers it exists for -- aria-hidden applies to the whole
              * subtree, sr-only content included.
              */}
            <span className="sr-only" role="status" aria-live="polite">
                {onStreak
                    ? t('burst_announce_streak', { points, multiplier: STREAK_MULTIPLIER })
                    : t('burst_announce', { points })}
            </span>

            <div
                className="pointer-events-none absolute -top-10 -end-4 z-20 select-none"
                aria-hidden="true"
            >
                {visual.sparkCount > 0 && !reduced && (
                    <Sparks
                        count={visual.sparkCount}
                        reach={visual.rise * SPARK_REACH}
                        className={visual.sparkClass}
                    />
                )}

                {visual.glowClass && !reduced && (
                    <motion.div
                        className={`absolute inset-0 -m-4 rounded-full blur-xl ${visual.glowClass}`}
                        initial={{ opacity: 0, scale: 0.4 }}
                        animate={{ opacity: [0, 1, 0], scale: [0.4, 1.3, 1.6] }}
                        transition={{ duration: DURATION * 0.7, ease: 'easeOut' }}
                    />
                )}

                <motion.div
                    className="relative flex items-center gap-1.5 whitespace-nowrap"
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 0, scale: 0.4 }}
                    animate={reduced
                        ? { opacity: [0, 1, 1, 0] }
                        : {
                            opacity: [0, 1, 1, 0],
                            // Overshoot, settle, then drift. The overshoot is what
                            // makes it read as an impact rather than a fade-in.
                            y: [0, -visual.rise * 0.35, -visual.rise * 0.55, -visual.rise],
                            scale: [0.4, visual.scale * 1.15, visual.scale, visual.scale * 0.95],
                        }}
                    transition={{ duration: DURATION, times: [0, 0.18, 0.6, 1], ease: 'easeOut' }}
                >
                    <span className={`text-3xl font-black drop-shadow-xl ${visual.numberClass}`}>
                        +{points}
                    </span>

                    {onStreak && (
                        <span className="flex items-center gap-0.5 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-xs font-bold text-orange-500 dark:bg-orange-400/15 dark:text-orange-300">
                            <Flame className="h-3 w-3" />
                            {STREAK_MULTIPLIER}&times;
                        </span>
                    )}
                </motion.div>
            </div>
        </>
    );
}

/**
 * Radial spark particles.
 *
 * Angles are derived from the index rather than randomised, so the burst is
 * identical on every render of the same solve — a `Math.random()` here would
 * also be a hydration hazard the day this renders on the server.
 */
function Sparks({ count, reach, className }: { count: number; reach: number; className: string }) {
    return (
        <>
            {Array.from({ length: count }, (_, i) => {
                const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.2;
                const distance = reach * (0.6 + ((i % 4) / 4) * 0.6);

                return (
                    <motion.span
                        key={i}
                        className={`absolute start-1/2 top-1/2 h-1.5 w-1.5 rounded-full ${className}`}
                        initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                        animate={{
                            opacity: [1, 1, 0],
                            x: Math.cos(angle) * distance,
                            y: Math.sin(angle) * distance,
                            scale: [1, 0.8, 0.2],
                        }}
                        transition={{ duration: DURATION * 0.65, ease: 'easeOut' }}
                    />
                );
            })}
        </>
    );
}
