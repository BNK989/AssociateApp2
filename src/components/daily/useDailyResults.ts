import { useCallback, useEffect, useRef, useState } from 'react';
import { createLogger } from '@/lib/logger';
import { getClientId } from '@/lib/daily/clientId';
import { buildResultPayload, type WordOutcome, type WordResult } from '@/lib/daily/dailyResults';

const log = createLogger('daily/results');

const ENDPOINT = '/api/daily/result';

export type RecordWordArgs = {
    index: number;
    outcome: WordOutcome;
    hintLevel: number;
    strikes: number;
    points: number;
    /** Running score after this word, since the hook does not own the score. */
    totalScore: number;
    completed: boolean;
};

type UseDailyResultsArgs = {
    playDate: string;
    wordsTotal: number;
    /** Id of the word currently being guessed; a change restarts the timer. */
    activeWordId: string | null;
    accessToken?: string;
};

/**
 * Records how a player actually got through the day's chain.
 *
 * Two things make this more than a completion counter. It writes after **every**
 * word rather than only at the end, because a player who quits at word 8 of 12
 * never reaches the end and that abandonment is the number we most need; and it
 * times each word by *attention* rather than wall clock, stopping while the tab
 * is hidden and capping a word that was clearly walked away from.
 *
 * Every write is best-effort. A daily game has never depended on the server and
 * still does not: a failed sync is logged and the player never sees it.
 */
export function useDailyResults({
    playDate,
    wordsTotal,
    activeWordId,
    accessToken,
}: UseDailyResultsArgs) {
    const perWordRef = useRef<WordResult[]>([]);
    const clientIdRef = useRef<string | null>(null);

    // Consecutive days finished, as counted by the server when the day is
    // completed. Null until then -- an unfinished game has no streak to show.
    const [streak, setStreak] = useState<number | null>(null);

    // Active-time accounting for the word on screen: time already banked before
    // the tab was last hidden, plus the run since it came back into view.
    const bankedMsRef = useRef(0);
    const resumedAtRef = useRef<number | null>(null);

    // Serialises the upserts so two words resolved in quick succession cannot
    // land out of order and record a shorter game than the player played.
    const queueRef = useRef<Promise<void>>(Promise.resolve());

    const readElapsed = useCallback(() => {
        const running = resumedAtRef.current === null ? 0 : Date.now() - resumedAtRef.current;
        return bankedMsRef.current + running;
    }, []);

    const restartTimer = useCallback(() => {
        bankedMsRef.current = 0;
        resumedAtRef.current = typeof document === 'undefined' || document.visibilityState === 'visible'
            ? Date.now()
            : null;
    }, []);

    const sync = useCallback((totalScore: number, completed: boolean) => {
        const clientId = clientIdRef.current;
        if (!clientId) return;

        const payload = buildResultPayload({
            clientId,
            playDate,
            wordsTotal,
            score: totalScore,
            perWord: perWordRef.current,
            completed,
        });

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

        queueRef.current = queueRef.current
            .then(async () => {
                const res = await fetch(ENDPOINT, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                });

                if (!res.ok) {
                    const body = await res.text();
                    log.warn('sync', 'Daily result was rejected by the server', {
                        play_date: playDate,
                        status: res.status,
                        progress: payload.per_word.length,
                        body: body.slice(0, 200),
                    });
                    return;
                }

                const result = await res.json();
                if (typeof result?.streak === 'number') {
                    setStreak(result.streak);
                }
            })
            .catch((e) => {
                log.warn('sync', 'Failed to record daily result, continuing without it', {
                    play_date: playDate,
                    progress: payload.per_word.length,
                }, e);
            });
    }, [playDate, wordsTotal, accessToken]);

    // Stop the clock while the tab is hidden, so a game left open overnight is
    // not recorded as an eight-hour puzzle.
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                resumedAtRef.current = Date.now();
                return;
            }
            bankedMsRef.current = readElapsed();
            resumedAtRef.current = null;
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [readElapsed]);

    // `sync` is rebuilt when the access token arrives, which happens partway
    // through a game. Reached through a ref so that the effect below can key on
    // the play date alone -- depending on `sync` directly would re-run it the
    // moment auth resolves and wipe a log the player is halfway through.
    const syncRef = useRef(sync);
    useEffect(() => {
        syncRef.current = sync;
    }, [sync]);

    // Open the day's row as soon as the board is live. A row with an empty log
    // is a player who arrived and solved nothing -- the denominator every
    // drop-off rate is measured against.
    useEffect(() => {
        clientIdRef.current = getClientId();
        perWordRef.current = [];
        restartTimer();
        syncRef.current(0, false);
    }, [playDate, restartTimer]);

    // Each new target word starts its own clock.
    useEffect(() => {
        if (!activeWordId) return;
        restartTimer();
    }, [activeWordId, restartTimer]);

    const recordWord = useCallback(({
        index,
        outcome,
        hintLevel,
        strikes,
        points,
        totalScore,
        completed,
    }: RecordWordArgs) => {
        perWordRef.current = [
            ...perWordRef.current,
            { index, outcome, hint_level: hintLevel, strikes, points, ms: readElapsed() },
        ];

        restartTimer();
        syncRef.current(totalScore, completed);
    }, [readElapsed, restartTimer]);

    return { recordWord, streak };
}
