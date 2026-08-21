import { useEffect, useRef, useState } from 'react';
import type { Message } from '@/hooks/useGameLogic';
import { MAX_HINT_LEVEL } from '@/lib/daily/dailyScoring';

/** Delay between reveals in "instant" mode, so hints do not all land at once. */
const INSTANT_LOOP_MS = 500;

const TICK_MS = 1000;

type UseAutoHintArgs = {
    targetMessage?: Message;
    gameOver: boolean;
    enabled: boolean;
    duration: number;
    onReveal: () => void;
};

/**
 * Counts down to the next automatic hint on the current word.
 *
 * The timer restarts whenever the target changes. A duration of zero means
 * "instant": rather than firing continuously, it reveals then re-arms after a
 * short pause, so a player watching sees the levels step up one at a time.
 *
 * Revealing stops once the word is at the maximum hint level — there is nothing
 * further to give away.
 */
export function useAutoHint({
    targetMessage,
    gameOver,
    enabled,
    duration,
    onReveal,
}: UseAutoHintArgs) {
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const prevTargetIdRef = useRef<string | null>(null);
    const instantLoopRef = useRef<NodeJS.Timeout | null>(null);

    // Held in a ref so a new callback identity does not restart the countdown.
    const onRevealRef = useRef(onReveal);
    useEffect(() => {
        onRevealRef.current = onReveal;
    }, [onReveal]);

    const clearInstantLoop = () => {
        if (instantLoopRef.current) {
            clearTimeout(instantLoopRef.current);
            instantLoopRef.current = null;
        }
    };

    useEffect(() => {
        const isIdle = !targetMessage || gameOver || !enabled;

        if (isIdle) {
            setSecondsLeft(duration > 0 ? duration : 0);
            prevTargetIdRef.current = null;
            clearInstantLoop();
            return;
        }

        if (targetMessage.id !== prevTargetIdRef.current) {
            setSecondsLeft(duration);
            prevTargetIdRef.current = targetMessage.id;
            clearInstantLoop();
        }

        // Switching to instant mid-countdown should not wait out the old timer.
        if (duration <= 0) setSecondsLeft(0);

        if (isPaused) return;

        const interval = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, TICK_MS);

        return () => clearInterval(interval);
    }, [targetMessage, gameOver, enabled, isPaused, duration]);

    // Fire once the countdown reaches zero.
    useEffect(() => {
        if (secondsLeft !== 0 || !enabled || isPaused || gameOver) return;
        if (!targetMessage || (targetMessage.hint_level || 0) >= MAX_HINT_LEVEL) return;

        onRevealRef.current();

        if (duration > 0) {
            setSecondsLeft(duration);
            clearInstantLoop();
            return;
        }

        // Instant mode: bounce off zero so this effect can fire again.
        setSecondsLeft(0.1);
        clearInstantLoop();
        instantLoopRef.current = setTimeout(() => {
            setSecondsLeft(0);
            instantLoopRef.current = null;
        }, INSTANT_LOOP_MS);
    }, [secondsLeft, enabled, isPaused, gameOver, targetMessage, duration]);

    useEffect(() => clearInstantLoop, []);

    const progress = duration > 0 ? ((duration - secondsLeft) / duration) * 100 : 0;

    return {
        secondsLeft,
        progress,
        isPaused,
        togglePause: () => setIsPaused((prev) => !prev),
        isActive: enabled && !gameOver && Boolean(targetMessage) && duration > 0,
    };
}
