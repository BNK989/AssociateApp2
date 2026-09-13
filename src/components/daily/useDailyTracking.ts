import { useCallback, useEffect, useRef } from 'react';
import type { WordOutcome } from '@/lib/daily/dailyResults';
import type { MissBand } from '@/lib/daily/guessFeedback';
import { typeableCapacity } from '@/lib/letterPool/slotRules';
import {
    wordContext,
    type HintSource,
    type SettleSource,
    type UserType,
    type WordSnapshot,
} from '@/lib/daily/dailyAnalytics';
import { useDailyAnalytics } from './useDailyAnalytics';
import { useOfferTracking } from './useOfferTracking';

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
    /** Letters the settle drip placed on this word before it left the board. */
    settled: number;
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

    const totals = useRef({ solved: 0, revealed: 0, hints: 0, settled: 0, openedOtherEnd: false });

    /**
     * When the last letter settled, so a solve can say how long after it came.
     *
     * A timestamp rather than a duration, and cleared on every new word: the
     * gap between the letter landing and the solve is the only evidence that
     * the letter did the work, and a stale reading from the previous word would
     * be worse than none.
     */
    const lastSettleAt = useRef<number | null>(null);

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
            {
                hint_level: word.hintLevel,
                strikes: word.strikes,
                settled_indices: settledStub(word.settled),
            },
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
            {
                hint_level: args.hintLevel,
                strikes: args.strikes,
                settled_indices: settledStub(args.settled),
            },
            args.index,
            args.ms,
        );

        const since = lastSettleAt.current;

        track('daily_word_solved', {
            ...shared,
            word: args.word,
            score_gained: args.points,
            total_score: args.totalScore,
            consecutive: args.consecutive,
            ms_since_last_settle: since === null ? null : Math.round(Date.now() - since),
        });
    }, [track, contextFor]);

    /**
     * One settled letter.
     *
     * The ordinal is taken from the caller's count rather than from a tally
     * here, because the drip is the only thing that knows whether a letter
     * actually landed — a tally kept on this side would drift the moment a
     * placement was refused by the ceiling.
     */
    const trackLetterSettled = useCallback((args: {
        word: WordSnapshot & { content: string };
        index: number;
        ms: number;
        slotIndex: number;
        settledCount: number;
        allowance: number;
        source: SettleSource;
    }) => {
        totals.current.settled += 1;
        lastSettleAt.current = Date.now();

        track('daily_letter_settled', {
            ...contextFor(args.word, args.index, args.ms),
            source: args.source,
            settle_ordinal: args.settledCount,
            slot_index: args.slotIndex,
            allowance: args.allowance,
            letters_total: typeableCapacity(args.word.content),
        });
    }, [track, contextFor]);

    /** A new word: the settle clock starts over, so a stale gap cannot leak. */
    const resetSettleClock = useCallback(() => {
        lastSettleAt.current = null;
    }, []);

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
            letters_settled_total: totals.current.settled,
        });
    }, [track]);

    const trackChainRevealed = useCallback((outcomeTier: string) => {
        track('daily_chain_revealed', {
            outcome_tier: outcomeTier,
            words_solved: totals.current.solved,
        });
    }, [track]);

    const offers = useOfferTracking(track, contextFor);

    return {
        trackWordFinished,
        trackWordSolved,
        trackLetterSettled,
        resetSettleClock,
        trackHint,
        trackMiss,
        trackOtherEndOpened,
        ...offers,
        setOtherEndOpen,
        trackCompleted,
        trackChainRevealed,
    };
}

export type DailyTracking = ReturnType<typeof useDailyTracking>;

/**
 * A count of settled letters, in the shape `wordContext` reads.
 *
 * A finished word arrives as a count rather than as the message it came from —
 * the board has already let it go — and `wordContext` deliberately takes the
 * indices so that no call site can report a length it worked out for itself.
 * An array of the right length is the honest bridge: the property derived from
 * it is identical, and there is still exactly one place that derives it.
 */
function settledStub(count: number): number[] {
    return new Array(Math.max(0, count)).fill(0);
}
