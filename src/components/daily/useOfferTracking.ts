import { useCallback, useRef } from 'react';
import type { WordContext, WordSnapshot } from '@/lib/daily/dailyAnalytics';

/**
 * The stuck offer's four events, kept together and away from the rest.
 *
 * Split from `useDailyTracking` when that file reached the line cap, and the
 * seam is the right one: these four share a piece of state nothing else needs
 * — the set of offers already reported as shown — and they are the only events
 * in the daily game that describe the *game* speaking rather than the player
 * acting.
 *
 * `track` and `contextFor` are passed in rather than re-derived, so every event
 * here carries the identical context the rest of the run reports. That is the
 * whole contract `dailyAnalytics` exists to hold: an event is only analysable
 * if it can be broken down against its neighbours.
 */
type Track = (name: 'daily_stuck_offer_shown' | 'daily_stuck_offer_reopened'
    | 'daily_stuck_offer_taken' | 'daily_stuck_offer_dismissed',
    props: WordContext & { offer: string }) => void;

type ContextFor = (word: WordSnapshot, index: number, ms: number) => WordContext;

export function useOfferTracking(track: Track, contextFor: ContextFor) {
    /**
     * One shown event per offer per word.
     *
     * The offer is re-decided on a timer, so the component would otherwise
     * report it on every tick and drown the taken/dismissed ratios that are the
     * only reason to collect it.
     */
    const shownRef = useRef(new Set<string>());
    const trackOfferShown = useCallback((
        word: WordSnapshot,
        index: number,
        ms: number,
        offer: string,
    ) => {
        const seen = `${index}:${offer}`;
        if (shownRef.current.has(seen)) return;
        shownRef.current.add(seen);

        track('daily_stuck_offer_shown', { ...contextFor(word, index, ms), offer });
    }, [track, contextFor]);

    /**
     * A collapsed offer the player opened back up.
     *
     * The one number that says whether stepping aside worked. An offer that
     * collapses and is never touched again is indistinguishable from one that
     * was dismissed, except that the player never had to say so — so without
     * this the chip could be dead furniture and nothing would show it.
     */
    const trackOfferReopened = useCallback((
        word: WordSnapshot,
        index: number,
        ms: number,
        offer: string,
    ) => {
        track('daily_stuck_offer_reopened', { ...contextFor(word, index, ms), offer });
    }, [track, contextFor]);

    const trackOfferTaken = useCallback((
        word: WordSnapshot,
        index: number,
        ms: number,
        offer: string,
    ) => {
        track('daily_stuck_offer_taken', { ...contextFor(word, index, ms), offer });
    }, [track, contextFor]);

    const trackOfferDismissed = useCallback((
        word: WordSnapshot,
        index: number,
        ms: number,
        offer: string,
    ) => {
        track('daily_stuck_offer_dismissed', { ...contextFor(word, index, ms), offer });
    }, [track, contextFor]);

    return { trackOfferShown, trackOfferReopened, trackOfferTaken, trackOfferDismissed };
}
