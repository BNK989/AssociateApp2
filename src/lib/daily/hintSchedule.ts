import { autoRevealDelay, clockOrigin, type DailyHintPolicy } from './hintPolicy';
import { MAX_HINT_LEVEL } from '@/lib/gameConfig';

/**
 * When the next automatic hint is due.
 *
 * Split out of `useAutoHint` so the arithmetic is testable without fake timers:
 * the hook owns the ticking and the state, this owns the question of when the
 * next reveal should land.
 */

/**
 * Shortest gap between two consecutive automatic reveals.
 *
 * Only binds when delays are zero. A policy of all-zero delays means "give the
 * whole ladder away at once", but firing three reveals inside one frame reads
 * as a glitch rather than as help — spacing them lets the player watch the
 * levels step up.
 */
export const MIN_REVEAL_SPACING_MS = 500;

export type RevealSchedule = {
    /** Timestamp the reveal is due. */
    deadline: number;
    /** Timestamp the visible countdown started, for the progress ring. */
    armedAt: number;
};

export type ScheduleInput = {
    policy: DailyHintPolicy;
    /** Hint level the word is currently at. */
    currentLevel: number;
    /** When the word became the active target. */
    wordOpenedAt: number;
    /** When the current rung armed — the word opening, or the last level change. */
    rungArmedAt: number;
    /** When the last automatic reveal fired, or null if none has this word. */
    lastRevealAt: number | null;
};

/**
 * The schedule for the next automatic reveal, or null when none is coming —
 * the ladder is finished, the master switch is off, or this rung is manual.
 *
 * Under `cumulative` the delay is an offset from the word opening, so a player
 * who took a hint manually simply arrives at the next target sooner; under
 * `per-rung` it is a gap measured from the previous reveal.
 */
export function revealSchedule({
    policy,
    currentLevel,
    wordOpenedAt,
    rungArmedAt,
    lastRevealAt,
}: ScheduleInput): RevealSchedule | null {
    const delaySeconds = autoRevealDelay(policy, currentLevel);
    if (delaySeconds === null) return null;

    const base = clockOrigin(policy) === 'word-opened' ? wordOpenedAt : rungArmedAt;
    const requested = base + delaySeconds * 1000;

    // Never fire two reveals on top of each other, however short the delay.
    const earliest = lastRevealAt === null ? requested : lastRevealAt + MIN_REVEAL_SPACING_MS;
    const deadline = Math.max(requested, earliest);

    // The countdown the player watches starts at whichever happened last: the
    // word opening, the level changing, or the previous reveal.
    const startedAt = Math.max(base, rungArmedAt, lastRevealAt ?? base);

    return { deadline, armedAt: Math.min(startedAt, deadline) };
}

/** Whole seconds still on the clock, never negative. */
export function secondsUntil(schedule: RevealSchedule | null, now: number): number {
    if (!schedule) return 0;
    return Math.max(0, Math.ceil((schedule.deadline - now) / 1000));
}

/** How far the countdown has run, 0–100, for the progress ring. */
export function progressPercent(schedule: RevealSchedule | null, now: number): number {
    if (!schedule) return 0;

    const span = schedule.deadline - schedule.armedAt;
    if (span <= 0) return 100;

    const elapsed = now - schedule.armedAt;
    return Math.max(0, Math.min(100, (elapsed / span) * 100));
}

/** Whether the reveal is due. */
export function isDue(schedule: RevealSchedule | null, now: number): boolean {
    return schedule !== null && now >= schedule.deadline;
}


export type TimelineEntry = {
    /** Hint level the player reaches. */
    level: number;
    /** Seconds after the word opens, or null when only a manual hint gets there. */
    atSeconds: number | null;
};

/**
 * When each hint lands on a fresh word, for the admin panel's preview.
 *
 * Built by running the real scheduler rather than by re-deriving the timings,
 * so the preview cannot drift from what players actually experience — which is
 * the only thing that makes it worth showing. A rung that never fires
 * automatically ends the timeline: the ladder stops there until the player asks.
 */
export function previewTimeline(policy: DailyHintPolicy): TimelineEntry[] {
    const entries: TimelineEntry[] = [];
    const startLevel = Math.max(0, Math.min(MAX_HINT_LEVEL, policy.startLevel));

    // A level the word opens at is already there when the player arrives.
    if (startLevel > 0) entries.push({ level: startLevel, atSeconds: 0 });

    const wordOpenedAt = 0;
    let rungArmedAt = 0;
    let lastRevealAt: number | null = null;

    for (let level = startLevel; level < MAX_HINT_LEVEL; level += 1) {
        const schedule = revealSchedule({
            policy,
            currentLevel: level,
            wordOpenedAt,
            rungArmedAt,
            lastRevealAt,
        });

        if (!schedule) {
            entries.push({ level: level + 1, atSeconds: null });
            break;
        }

        entries.push({ level: level + 1, atSeconds: schedule.deadline / 1000 });
        rungArmedAt = schedule.deadline;
        lastRevealAt = schedule.deadline;
    }

    return entries;
}
