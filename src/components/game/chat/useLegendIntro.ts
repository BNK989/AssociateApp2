import { useCallback, useEffect, useRef, useState } from 'react';
import { usePostHog } from 'posthog-js/react';
import { createLogger } from '@/lib/logger';

const log = createLogger('game/legendIntro');

/** Shown once ever, across every game and both modes. */
const STORAGE_KEY = 'associ8-legend-intro-seen';

type UseLegendIntroArgs = {
    /** The word being solved is showing a coloured tile to this player. */
    active: boolean;
    hintLevel: number;
    /** Guesses spent on this word, watched so the key steps aside once play resumes. */
    guessCount: number;
};

/**
 * The colour key, pushed once at the moment it first means something.
 *
 * The palette button in the composer is a *pull* affordance, and a player who
 * has never seen a coloured tile has no reason to suspect it explains one. The
 * key therefore opens itself inside the bubble the first time that bubble
 * colours a tile, and never again on this device.
 *
 * It closes on the player's next move — a dismiss, a guess, or the word
 * settling — because by then it has either been read or is in the way.
 */
export function useLegendIntro({ active, hintLevel, guessCount }: UseLegendIntroArgs) {
    const posthog = usePostHog();
    const [isOpen, setIsOpen] = useState(false);
    // Assume seen until storage says otherwise: nothing should flash open during
    // the first paint and then take itself back.
    const [hasSeen, setHasSeen] = useState(true);
    const openedAtGuessCount = useRef(0);

    useEffect(() => {
        setHasSeen(readSeen());
    }, []);

    useEffect(() => {
        if (!active || hasSeen) return;
        openedAtGuessCount.current = guessCount;
        setIsOpen(true);
        setHasSeen(true);
        writeSeen();
        posthog?.capture('legend_intro_shown', { hint_level: hintLevel });
    }, [active, hasSeen, hintLevel, guessCount, posthog]);

    useEffect(() => {
        if (!isOpen) return;
        if (active && guessCount === openedAtGuessCount.current) return;
        setIsOpen(false);
        posthog?.capture('legend_intro_closed', { reason: active ? 'guessed' : 'word_settled' });
    }, [isOpen, active, guessCount, posthog]);

    const dismiss = useCallback(() => {
        setIsOpen(false);
        posthog?.capture('legend_intro_closed', { reason: 'dismissed' });
    }, [posthog]);

    return { isOpen, dismiss };
}

/**
 * Storage reads are guarded because a browser in private mode throws on access
 * rather than returning null, and a thrown key must not take the board with it.
 */
function readSeen(): boolean {
    try {
        return Boolean(localStorage.getItem(STORAGE_KEY));
    } catch (error) {
        log.warn('read_seen', `[legend] cannot read ${STORAGE_KEY}, treating the key as seen`, {
            storageKey: STORAGE_KEY,
        }, error);
        return true;
    }
}

function writeSeen() {
    try {
        localStorage.setItem(STORAGE_KEY, 'true');
    } catch (error) {
        log.warn('write_seen', `[legend] cannot persist ${STORAGE_KEY}, the key may open again`, {
            storageKey: STORAGE_KEY,
        }, error);
    }
}
