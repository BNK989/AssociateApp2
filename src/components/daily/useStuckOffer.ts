import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    stuckOffer, type ChoiceFork, type StuckOffer, type StuckTiming,
} from '@/lib/daily/stuckSignals';

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
    /** Whether the settle drip has a letter left to place on this word. */
    canSettle: boolean;
    /** Loose letters the player could place themselves right now. */
    /** Letters the drip may still place, for the settle offer's own copy. */
    settleLettersLeft: number;
    consecutive: number;
    wordsLeft: number;
    /** Suppresses everything — game over, or the board not ready. */
    paused: boolean;
    /** The game master's clock, from the settle policy. */
    timing: StuckTiming;
    /** The game master's fork: which rung asks, and what it asks with. */
    choice: ChoiceFork;
    /**
     * Dwell credited on top of the clock, in milliseconds.
     *
     * The same shape as the credit a wrong guess already buys, and it exists
     * for the same reason: the ladder is driven by pressure rather than by
     * wall-clock time, so pressure can be supplied. The admin demo board uses
     * it to skip the wait instead of making a game master sit out twenty
     * seconds of silence to see what they just configured. Zero in the game.
     */
    creditMs?: number;
};

export function useStuckOffer({
    targetId,
    strikes,
    hintLevel,
    canOpenOtherEnd,
    canSettle,
    settleLettersLeft,
    consecutive,
    wordsLeft,
    paused,
    timing,
    choice,
    creditMs = 0,
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
            msOnWord: msOnWord + creditMs,
            strikes,
            hintLevel,
            canOpenOtherEnd,
            canSettle,
            settleLettersLeft,
            consecutive,
            wordsLeft,
            dismissed,
            timing,
            choice,
        });
    }, [
        paused, targetId, msOnWord, strikes, hintLevel,
        canOpenOtherEnd, canSettle, settleLettersLeft,
        consecutive, wordsLeft, dismissed, timing, choice, creditMs,
    ]);

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
