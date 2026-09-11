import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Message } from '@/hooks/useGameLogic';
import type { WordOutcome } from '@/lib/daily/dailyResults';
import type { HintSource } from '@/lib/daily/dailyAnalytics';
import type { MissBand } from '@/lib/daily/guessFeedback';
import type { RecordWordArgs } from './useDailyResults';
import type { DailyTracking } from './useDailyTracking';

/**
 * The callbacks `useDailyGame` fires, wired to the results log, the analytics
 * layer and the on-screen cues.
 *
 * This is glue, and it lives here rather than inline in `DailyGameClient`
 * because the board component is near the file-size cap and this is the least
 * interesting thing in it. Keeping it together also means the order that
 * matters is visible in one place: `recordWord` is called *first* on a finished
 * word, because it hands back the active time it just banked and every event
 * about that word is stamped with the same number rather than a second reading
 * of a clock it has already reset.
 *
 * Everything it depends on is reached through refs. The results hook needs the
 * word currently in play, which only exists once the game hook has run, and the
 * game hook needs these callbacks — so one side of the cycle has to be late.
 */

type Cues = {
    showProgressCue: (args: {
        outcome: WordOutcome;
        remaining: number;
        total: number;
        consecutive: number;
        completed: boolean;
    }) => void;
    showMissCue: (band: MissBand, forgiven: boolean) => void;
};

type UseDailyInstrumentationArgs = Cues & {
    tracking: DailyTracking;
    /** Guessable words in the chain; the free starting word is not one. */
    guessableWords: number;
};

export function useDailyInstrumentation({
    tracking,
    guessableWords,
    showProgressCue,
    showMissCue,
}: UseDailyInstrumentationArgs) {
    const recordWordRef = useRef<((args: RecordWordArgs) => number) | null>(null);
    const elapsedRef = useRef<(() => number) | null>(null);
    const trackingRef = useRef(tracking);
    const outcomeTierRef = useRef('blank');

    useEffect(() => {
        trackingRef.current = tracking;
    }, [tracking]);

    const callbacks = useMemo(() => ({
        onWordFinished: (args: {
            index: number;
            word: string;
            outcome: WordOutcome;
            hintLevel: number;
            strikes: number;
            points: number;
            totalScore: number;
            remaining: number;
            consecutive: number;
            hintsExhausted: boolean;
            completed: boolean;
        }) => {
            const ms = recordWordRef.current?.(args) ?? 0;
            const finished = { ...args, parkCount: 0, ms };

            trackingRef.current.trackWordFinished(finished);
            if (args.outcome === 'solved') {
                trackingRef.current.trackWordSolved({ ...finished, solvedAfterPark: false });
            }

            showProgressCue({
                outcome: args.outcome,
                remaining: args.remaining,
                total: guessableWords,
                consecutive: args.consecutive,
                completed: args.completed,
            });
        },

        onCompleted: (finalScore: number, endedOn: WordOutcome) => {
            // The tier is read off the share grid rather than recomputed, so
            // the event, the end screen and the squares a player pastes into a
            // chat can never disagree about how the day went.
            trackingRef.current.trackCompleted(finalScore, endedOn, outcomeTierRef.current);
        },

        onMissed: (args: {
            message: Message;
            index: number;
            band: MissBand;
            similarity: number;
            strikeForgiven: boolean;
        }) => {
            showMissCue(args.band, args.strikeForgiven);
            trackingRef.current.trackMiss(
                args.message,
                args.index,
                elapsedRef.current?.() ?? 0,
                args.band,
                args.similarity,
                args.strikeForgiven,
            );
        },

        onHintRevealed: (args: {
            message: Message;
            index: number;
            toLevel: number;
            source: HintSource;
        }) => {
            trackingRef.current.trackHint(
                args.message,
                args.index,
                elapsedRef.current?.() ?? 0,
                args.source,
                args.toLevel,
            );
        },
    }), [guessableWords, showProgressCue, showMissCue]);

    /**
     * Hands over the results log once it exists.
     *
     * A setter rather than an exposed ref: the caller writing to
     * `something.ref.current` is both harder to read and something React's
     * compiler lint rejects outright.
     */
    const attachResults = useCallback((
        recordWord: (args: RecordWordArgs) => number,
        readElapsed: () => number,
    ) => {
        recordWordRef.current = recordWord;
        elapsedRef.current = readElapsed;
    }, []);

    /**
     * Counts the end screen actually showing the chain.
     *
     * Separate from completion on purpose: the point of the reveal is that
     * every tier gets it, a blank board included, and only an event fired from
     * the screen itself can show that a player who solved nothing saw the
     * payoff. Idempotent, because the dialog can re-render.
     */
    const chainRevealedRef = useRef(false);
    const trackChainRevealed = useCallback(() => {
        if (chainRevealedRef.current) return;
        chainRevealedRef.current = true;
        trackingRef.current.trackChainRevealed(outcomeTierRef.current);
    }, []);

    /** Keeps the completion event's tier in step with the grid. */
    const setOutcomeTier = useCallback((tier: string) => {
        outcomeTierRef.current = tier;
    }, []);

    return { callbacks, attachResults, setOutcomeTier, trackChainRevealed };
}
