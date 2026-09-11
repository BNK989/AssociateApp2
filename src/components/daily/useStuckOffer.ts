import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stuckOffer, type StuckOffer } from '@/lib/daily/stuckSignals';

/**
 * Watches for a player who has gone quiet on a word, and decides what to offer.
 *
 * The clock is a plain interval rather than a chain of timeouts because the
 * decision depends on strikes as well as time — a wrong guess buys dwell time —
 * and re-deciding on a tick is simpler than rescheduling on every input change.
 * Two seconds is well under the thresholds and costs nothing.
 *
 * Dwell is measured from when the word became the target and **resets on every
 * word**, including the dismissal: waving an offer away silences it for that
 * word alone, so the next word starts fresh rather than the player having
 * opted out of encouragement for the rest of the day.
 */

/** How often the offer is re-decided. Well under the smallest threshold. */
const TICK_MS = 2000;

type UseStuckOfferArgs = {
    /** Id of the word in play; a change restarts the clock. */
    targetId: string | null;
    strikes: number;
    hintLevel: number;
    canOpenOtherEnd: boolean;
    consecutive: number;
    wordsLeft: number;
    /** Suppresses everything — game over, or the board not ready. */
    paused: boolean;
};

export function useStuckOffer({
    targetId,
    strikes,
    hintLevel,
    canOpenOtherEnd,
    consecutive,
    wordsLeft,
    paused,
}: UseStuckOfferArgs) {
    const [msOnWord, setMsOnWord] = useState(0);
    const [dismissed, setDismissed] = useState(false);
    // Seeded in the effect below rather than here: reading the clock during
    // render is impure, and the effect runs before the first tick anyway.
    const startedAt = useRef(0);

    // A new word is a fresh start: clock back to zero, dismissal forgotten.
    useEffect(() => {
        startedAt.current = Date.now();
        setMsOnWord(0);
        setDismissed(false);
    }, [targetId]);

    useEffect(() => {
        if (paused || !targetId) return;

        const timer = setInterval(() => {
            // Reading the clock rather than accumulating ticks, so a
            // backgrounded tab that throttles the interval does not under-count
            // the time the player was away from the word.
            setMsOnWord(Date.now() - startedAt.current);
        }, TICK_MS);

        return () => clearInterval(timer);
    }, [paused, targetId]);

    const offer = useMemo<StuckOffer | null>(() => {
        if (paused || !targetId) return null;

        return stuckOffer({
            msOnWord,
            strikes,
            hintLevel,
            canOpenOtherEnd,
            consecutive,
            wordsLeft,
            dismissed,
        });
    }, [paused, targetId, msOnWord, strikes, hintLevel, canOpenOtherEnd, consecutive, wordsLeft, dismissed]);

    /**
     * Silences the offer for this word.
     *
     * Both taking an offer up and waving it away land here. They are different
     * events to record — one is the mechanic working, the other is it being
     * unwanted — but identical to the board, which simply stops asking.
     */
    const silence = useCallback(() => setDismissed(true), []);

    return { offer, dismiss: silence, accept: silence };
}
