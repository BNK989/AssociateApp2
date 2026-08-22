import { useEffect, useMemo, useRef, useState } from 'react';
import type { Message } from '@/hooks/useGameLogic';
import { MAX_HINT_LEVEL } from '@/lib/daily/dailyScoring';
import type { DailyHintPolicy } from '@/lib/daily/hintPolicy';
import {
    isDue,
    progressPercent,
    revealSchedule,
    secondsUntil,
} from '@/lib/daily/hintSchedule';

/**
 * How often the countdown is re-read.
 *
 * Finer than the one-second display so a zero-delay burst, which is spaced by
 * half a second, still steps at the rate it was scheduled for.
 */
const TICK_MS = 250;

type UseAutoHintArgs = {
    targetMessage?: Message;
    gameOver: boolean;
    policy: DailyHintPolicy;
    onReveal: () => void;
};

/**
 * Timestamps the schedule is computed from, held together so they can only
 * change as a set.
 *
 * `targetId` is part of the state rather than a separate ref because it is what
 * makes a stale clock detectable: on the render after the word changes, this
 * still describes the previous word, and a schedule built from it would fire
 * instantly. The mismatch is checked before the schedule is used.
 */
type HintClock = {
    targetId: string;
    wordOpenedAt: number;
    rungArmedAt: number;
    lastRevealAt: number | null;
};

/**
 * Counts down to the next automatic hint on the current word.
 *
 * The rules — which rungs fire, how long each waits, and whether delays are
 * gaps or offsets from the word opening — all live in the policy, and the
 * arithmetic lives in `hintSchedule`. What is left here is the clock: when to
 * restart it, when to freeze it, and when to call the reveal.
 *
 * Revealing stops once the word is at the maximum hint level, or when the
 * policy has nothing automatic left to give.
 */
export function useAutoHint({
    targetMessage,
    gameOver,
    policy,
    onReveal,
}: UseAutoHintArgs) {
    const [isPaused, setIsPaused] = useState(false);
    const [clock, setClock] = useState<HintClock | null>(null);
    const [now, setNow] = useState(() => Date.now());

    const targetId = targetMessage?.id ?? null;
    const currentLevel = targetMessage?.hint_level || 0;
    const isIdle = !targetMessage || gameOver;

    // Held in a ref so a new callback identity does not restart the countdown.
    const onRevealRef = useRef(onReveal);
    useEffect(() => {
        onRevealRef.current = onReveal;
    }, [onReveal]);

    // Restart the clock when the player moves to a new word.
    useEffect(() => {
        if (!targetId || isIdle) {
            setClock(null);
            return;
        }

        setClock((prev) => {
            if (prev?.targetId === targetId) return prev;
            const startedAt = Date.now();
            return { targetId, wordOpenedAt: startedAt, rungArmedAt: startedAt, lastRevealAt: null };
        });
    }, [targetId, isIdle]);

    // Re-arm when the word's hint level changes, however it changed — an
    // automatic reveal and a manual one both restart a per-rung countdown.
    useEffect(() => {
        setClock((prev) => {
            if (!prev || prev.targetId !== targetId) return prev;
            return { ...prev, rungArmedAt: Date.now() };
        });
    }, [currentLevel, targetId]);

    // Freeze the clock while paused by pushing every timestamp forward once the
    // player resumes, so a pause costs no thinking time.
    const pausedAtRef = useRef<number | null>(null);
    useEffect(() => {
        if (isPaused) {
            pausedAtRef.current = Date.now();
            return;
        }

        const pausedAt = pausedAtRef.current;
        pausedAtRef.current = null;
        if (pausedAt === null) return;

        const frozen = Date.now() - pausedAt;
        setClock((prev) => prev && ({
            ...prev,
            wordOpenedAt: prev.wordOpenedAt + frozen,
            rungArmedAt: prev.rungArmedAt + frozen,
            lastRevealAt: prev.lastRevealAt === null ? null : prev.lastRevealAt + frozen,
        }));
    }, [isPaused]);

    useEffect(() => {
        if (isIdle || isPaused) return;

        const id = setInterval(() => setNow(Date.now()), TICK_MS);
        return () => clearInterval(id);
    }, [isIdle, isPaused]);

    // A clock describing a different word is stale by one render; ignoring it
    // is what stops a fresh word inheriting the previous word's deadline.
    const schedule = useMemo(() => {
        if (isIdle || !clock || clock.targetId !== targetId) return null;
        if (currentLevel >= MAX_HINT_LEVEL) return null;

        return revealSchedule({
            policy,
            currentLevel,
            wordOpenedAt: clock.wordOpenedAt,
            rungArmedAt: clock.rungArmedAt,
            lastRevealAt: clock.lastRevealAt,
        });
    }, [isIdle, clock, targetId, currentLevel, policy]);

    useEffect(() => {
        if (isPaused || !schedule || !isDue(schedule, now)) return;

        // Recorded before the reveal so the spacing floor applies even if the
        // hint level does not change — otherwise a reveal that no-ops would
        // re-fire on every tick.
        setClock((prev) => prev && ({ ...prev, lastRevealAt: Date.now() }));
        onRevealRef.current();
    }, [schedule, now, isPaused]);

    const secondsLeft = secondsUntil(schedule, now);

    return {
        secondsLeft,
        progress: progressPercent(schedule, now),
        isPaused,
        togglePause: () => setIsPaused((prev) => !prev),
        // A countdown with no span is a burst, not something worth rendering a
        // ring for.
        isActive: schedule !== null && schedule.deadline > schedule.armedAt,
    };
}
