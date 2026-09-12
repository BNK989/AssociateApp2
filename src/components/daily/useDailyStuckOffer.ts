import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Message } from '@/hooks/useGameLogic';
import { wordsInPlay } from '@/lib/daily/chainFronts';
import type { StuckOfferKind } from '@/lib/daily/stuckSignals';
import { useStuckOffer } from './useStuckOffer';

/**
 * The stuck offer, wired to the moves it names and to the datalayer.
 *
 * Kept apart from both `useStuckOffer`, which decides *whether* to speak, and
 * `DailyGameClient`, which is at the file-size cap and has no business knowing
 * that "letter" means the hint ladder. The mapping from an offer to the action
 * behind it lives here and nowhere else, so an offer can never be shown with
 * nothing wired to it.
 */

type Actions = {
    openOtherEnd: () => void;
    revealHint: () => void;
    revealWord: () => void;
};

type UseDailyStuckOfferArgs = Actions & {
    messages: Message[];
    targetMessage?: Message;
    targetIndex: number;
    canOpenOtherEnd: boolean;
    consecutive: number;
    gameOver: boolean;
    /** Reports an offer's life: shown, reopened, taken, or waved away. */
    trackOffer: (
        event: 'shown' | 'reopened' | 'taken' | 'dismissed',
        word: { hint_level?: number | null; strikes?: number | null },
        index: number,
        offer: string,
    ) => void;
};

export function useDailyStuckOffer({
    messages,
    targetMessage,
    targetIndex,
    canOpenOtherEnd,
    consecutive,
    gameOver,
    openOtherEnd,
    revealHint,
    revealWord,
    trackOffer,
}: UseDailyStuckOfferArgs) {
    const wordsLeft = useMemo(() => wordsInPlay(messages).length, [messages]);

    const { offer, dismiss, accept } = useStuckOffer({
        targetId: targetMessage?.id ?? null,
        strikes: targetMessage?.strikes ?? 0,
        hintLevel: targetMessage?.hint_level ?? 0,
        canOpenOtherEnd,
        consecutive,
        wordsLeft,
        paused: gameOver || !targetMessage,
    });

    // Reached through a ref so that reporting an offer cannot re-run on every
    // render of the board behind it.
    const wordRef = useRef({ message: targetMessage, index: targetIndex });
    useEffect(() => {
        wordRef.current = { message: targetMessage, index: targetIndex };
    }, [targetMessage, targetIndex]);

    const report = useCallback((event: 'shown' | 'reopened' | 'taken' | 'dismissed', kind: string) => {
        const { message, index } = wordRef.current;
        if (!message) return;
        trackOffer(event, message, index, kind);
    }, [trackOffer]);

    // An offer appearing is an event in its own right: an offer shown and never
    // taken is the wrong offer, which only the ratio can tell us.
    useEffect(() => {
        if (offer) report('shown', offer.kind);
    }, [offer, report]);

    const onAct = useCallback((kind: StuckOfferKind) => {
        report('taken', kind);
        accept();

        if (kind === 'other_end') openOtherEnd();
        else if (kind === 'letter') revealHint();
        else if (kind === 'reveal') revealWord();
    }, [report, accept, openOtherEnd, revealHint, revealWord]);

    /**
     * The player pulling a collapsed offer back open.
     *
     * Not an acceptance and not a dismissal: it says the offer was wanted but
     * the timing was wrong, which is the only evidence that collapsing aside
     * beats closing outright.
     */
    const onReopen = useCallback(() => {
        if (offer) report('reopened', offer.kind);
    }, [offer, report]);

    const onDismiss = useCallback(() => {
        if (offer) report('dismissed', offer.kind);
        dismiss();
    }, [offer, report, dismiss]);

    return { offer, onAct, onReopen, onDismiss };
}
