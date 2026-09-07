import { useEffect } from 'react';
import { loadDailyGame, saveDailyGame, type DailyGameSnapshot } from '@/lib/daily/dailyStorage';
import type { DailyHintPolicy } from '@/lib/daily/hintPolicy';

type UseDailyPersistenceArgs = {
    date: string;
    words: string[];
    policy: DailyHintPolicy;
    /** Revision the board is being played under; a change may discard the save. */
    settingsRevision: number;
    /** The state to mirror back after every change. */
    snapshot: DailyGameSnapshot;
    /** A board recovered from storage, before the arrival pass is applied. */
    onRestore: (restored: DailyGameSnapshot) => void;
    /** No usable save for today, so the chain starts fresh. */
    onFresh: () => void;
};

/**
 * The daily board's localStorage half: read it once on arrival, write it back
 * on every change.
 *
 * Split out of `useDailyGame` so the state machine is only rules and the I/O is
 * only I/O. The restore path deliberately hands the raw save back rather than
 * setting state itself — the caller has to run the hint arrival pass over it
 * first, and burying that here would hide a scoring-relevant step inside a
 * function that looks like storage.
 */
export function useDailyPersistence({
    date,
    words,
    policy,
    settingsRevision,
    snapshot,
    onRestore,
    onFresh,
}: UseDailyPersistenceArgs) {
    const { messages, score, consecutive, gameOver } = snapshot;

    // Deliberately keyed on the day and the policy only. `onRestore`/`onFresh`
    // are read as they are at that moment: adding them to the deps would restart
    // the board whenever the caller re-rendered with new closures.
    useEffect(() => {
        const restored = loadDailyGame(date, words, {
            settingsRevision,
            onRevisionChange: policy.onRevisionChange,
        });

        if (restored) {
            onRestore(restored);
            return;
        }

        onFresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
    }, [date, words, settingsRevision, policy]);

    useEffect(() => {
        if (messages.length === 0) return;
        saveDailyGame(date, words, { messages, score, consecutive, gameOver }, settingsRevision);
    }, [messages, score, consecutive, gameOver, date, words, settingsRevision]);
}
