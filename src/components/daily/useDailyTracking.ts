import { useCallback, useEffect, useRef } from 'react';
import type { WordOutcome } from '@/lib/daily/dailyResults';
import type { MissBand } from '@/lib/daily/guessFeedback';
import {
    wordContext,
    type HintSource,
    type UserType,
    type WordSnapshot,
} from '@/lib/daily/dailyAnalytics';
import { useDailyAnalytics } from './useDailyAnalytics';

/**
 * Everything the daily game tells PostHog, in one place.
 *
 * It lives apart from `DailyGameClient` for two reasons. The board component is
 * near the file-size cap and instrumentation is the least interesting thing in
 * it; and a run's totals — hints taken, words revealed, parks used — have to be
 * accumulated across the whole chain to be reported at the end, which is state
 * that belongs beside the events rather than scattered through a render.
 *
 * The totals are refs, not state: nothing renders from them, and making them
 * state would re-render the board on every hint for no visible reason.
 */

type UseDailyTrackingArgs = {
    playDate: string;
    userType: UserType;
    settingsRevision: number;
    wordsTotal: number;
    /** Entrance is held back until auth resolves, so `user_type` is truthful. */
    authLoading: boolean;
};

export type FinishedWord = {
    index: number;
    outcome: WordOutcome;
    hintLevel: number;
    strikes: number;
    points: number;
    totalScore: number;
    consecutive: number;
    /** Active time on the word, as recorded by the results log. */
    ms: number;
    /** Whether the ladder was spent before the player revealed it. */
    hintsExhausted: boolean;
};

export function useDailyTracking({
    playDate,
    userType,
    settingsRevision,
    wordsTotal,
    authLoading,
}: UseDailyTrackingArgs) {
    const { track } = useDailyAnalytics({
        play_date: playDate,
        user_type: userType,
        settings_revision: settingsRevision,
        words_total: wordsTotal,
    });

    const totals = useRef({ solved: 0, revealed: 0, hints: 0, openedOtherEnd: false });

    /**
     * Whether the chain has been opened from its start.
     *
     * Held here rather than passed to each call so that every word-level event
     * reports it the same way and no call site can forget it. A setter rather
     * than an argument because the board that knows the answer is built from
     * these very callbacks — the cycle has to break somewhere.
     */
    const otherEndRef = useRef(false);
    const setOtherEndOpen = useCallback((open: boolean) => {
        otherEndRef.current = open;
    }, []);

    /** One reading of the board, so every event in a batch agrees. */
    const contextFor = useCallback(
        (word: WordSnapshot, index: number, ms: number) =>
            wordContext(word, index, ms, otherEndRef.current),
        [],
    );

    // Entrance is counted once, after auth resolves. It is the denominator for
    // every drop-off rate the daily game has, so counting it twice would
    // quietly halve all of them.
    const hasTrackedEntrance = useRef(false);
    useEffect(() => {
        if (authLoading || hasTrackedEntrance.current) return;
        hasTrackedEntrance.current = true;
        track('daily_game_entered', {});
    }, [authLoading, track]);

    const trackWordFinished = useCallback((word: FinishedWord) => {
        const shared = contextFor(
            { hint_level: word.hintLevel, strikes: word.strikes },
            word.index,
            word.ms,
        );

        if (word.outcome === 'solved') {
            totals.current.solved += 1;
            return;
        }

        if (word.outcome === 'gave_up') {
            totals.current.revealed += 1;
            track('daily_word_revealed', {
                ...shared,
                hints_exhausted: word.hintsExhausted,
                total_score: word.totalScore,
                consecutive: word.consecutive,
            });
            return;
        }

        track('daily_word_struck_out', { ...shared, total_score: word.totalScore });
    }, [track, contextFor]);

    /**
     * A solve, which carries the word itself and so cannot come from
     * `trackWordFinished` alone.
     *
     * Split out rather than threaded through, because the word is the one
     * property that must never leave the client for an unfinished chain: it is
     * the answer. It is safe here — a word only reaches this after it is off
     * the board.
     */
    const trackWordSolved = useCallback((args: FinishedWord & { word: string }) => {
        const shared = contextFor(
            { hint_level: args.hintLevel, strikes: args.strikes },
            args.index,
            args.ms,
        );

        track('daily_word_solved', {
            ...shared,
            word: args.word,
            score_gained: args.points,
            total_score: args.totalScore,
            consecutive: args.consecutive,
        });
    }, [track, contextFor]);

    const trackHint = useCallback((
        word: WordSnapshot,
        index: number,
        ms: number,
        source: HintSource,
        toLevel: number,
    ) => {
        totals.current.hints += 1;
        track('daily_hint_revealed', { ...contextFor(word, index, ms), source, to_level: toLevel });
    }, [track, contextFor]);

    const trackMiss = useCallback((
        word: WordSnapshot,
        index: number,
        ms: number,
        band: MissBand,
        similarity: number,
        strikeForgiven: boolean,
    ) => {
        track('daily_guess_missed', {
            ...contextFor(word, index, ms),
            band,
            similarity: Number(similarity.toFixed(3)),
            strike_forgiven: strikeForgiven,
        });
    }, [track, contextFor]);

    const trackOtherEndOpened = useCallback((
        word: WordSnapshot,
        index: number,
        ms: number,
        remaining: number,
    ) => {
        totals.current.openedOtherEnd = true;
        track('daily_other_end_opened', {
            ...contextFor(word, index, ms),
            words_remaining: remaining,
        });
    }, [track, contextFor]);

    const trackCompleted = useCallback((
        finalScore: number,
        endedOn: WordOutcome,
        outcomeTier: string,
    ) => {
        track('daily_game_completed', {
            final_score: finalScore,
            ended_on: endedOn,
            words_solved: totals.current.solved,
            outcome_tier: outcomeTier,
            hints_taken: totals.current.hints,
            words_revealed: totals.current.revealed,
            opened_other_end: totals.current.openedOtherEnd,
        });
    }, [track]);

    const trackChainRevealed = useCallback((outcomeTier: string) => {
        track('daily_chain_revealed', {
            outcome_tier: outcomeTier,
            words_solved: totals.current.solved,
        });
    }, [track]);

    return {
        trackWordFinished,
        trackWordSolved,
        trackHint,
        trackMiss,
        trackOtherEndOpened,
        setOtherEndOpen,
        trackCompleted,
        trackChainRevealed,
    };
}

export type DailyTracking = ReturnType<typeof useDailyTracking>;
