import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Message } from '@/hooks/useGameLogic';
import { wordsInPlay } from '@/lib/daily/chainFronts';
import type { WordSnapshot } from '@/lib/daily/dailyAnalytics';
import type { SettlePolicy } from '@/lib/daily/settlePolicy';
import { choicePrices, type StuckAction } from '@/lib/daily/stuckSignals';
import { calculateMessageValue } from '@/lib/gameLogic';
import { useStuckOffer } from './useStuckOffer';

/**
 * The stuck offer, wired to the moves it names and to the datalayer.
 *
 * Kept apart from both `useStuckOffer`, which decides *whether* to speak, and
 * `DailyGameClient`, which is at the file-size cap and has no business knowing
 * that "letter" means the hint ladder. The mapping from an offer to the action
 * behind it lives here and nowhere else, so an offer can never be shown with
 * nothing wired to it.
 *
 * The choice is the one offer carrying more than one action, and the game
 * master composes it: any of `clue`, `place`, `other_end` and `reveal` may
 * appear on it. Each is a move one of the single-action offers already makes
 * under another name — `clue` is the hint ladder's next rung, `place` starts
 * the drip — so every fork routes to a move that was already wired. The
 * datalayer sees them as `choice:clue`, `choice:place` and so on, which is what
 * makes the A/B readable.
 */

type Actions = {
    openOtherEnd: () => void;
    revealHint: () => void;
    revealWord: () => void;
    /** Starts the settle drip. The first letter lands on acceptance. */
    startSettle: () => void;
};

type UseDailyStuckOfferArgs = Actions & {
    messages: Message[];
    targetMessage?: Message;
    targetIndex: number;
    canOpenOtherEnd: boolean;
    /** Whether the drip has a letter left to place; decided by `settleRules`. */
    canSettle: boolean;
    /** Letters the drip may still place, for the settle offer's own copy. */
    settleLettersLeft: number;
    consecutive: number;
    gameOver: boolean;
    /** For the choice's price quote: the rates, and whether to quote at all. */
    settlePolicy: SettlePolicy;
    /** Reports an offer's life: shown, reopened, taken, or waved away. */
    trackOffer: (
        event: 'shown' | 'reopened' | 'taken' | 'dismissed',
        word: WordSnapshot,
        index: number,
        offer: string,
    ) => void;
};

export function useDailyStuckOffer({
    messages,
    targetMessage,
    targetIndex,
    canOpenOtherEnd,
    canSettle,
    settleLettersLeft,
    consecutive,
    gameOver,
    settlePolicy,
    openOtherEnd,
    revealHint,
    revealWord,
    startSettle,
    trackOffer,
}: UseDailyStuckOfferArgs) {
    const wordsLeft = useMemo(() => wordsInPlay(messages).length, [messages]);

    // Memoised so the offer is not re-decided on every render of the board;
    // the policy object itself is replaced only when the settings row changes.
    const timing = useMemo(() => ({
        firstOfferMs: settlePolicy.stuckFirstOfferMs,
        secondOfferMs: settlePolicy.stuckSecondOfferMs,
        strikeWorthMs: settlePolicy.stuckStrikeWorthMs,
    }), [settlePolicy]);

    const choice = useMemo(() => ({
        atHintLevel: settlePolicy.choiceAtHintLevel,
        options: settlePolicy.choiceOptions,
    }), [settlePolicy]);

    const { offer, dismiss, accept } = useStuckOffer({
        targetId: targetMessage?.id ?? null,
        strikes: targetMessage?.strikes ?? 0,
        hintLevel: targetMessage?.hint_level ?? 0,
        canOpenOtherEnd,
        canSettle,
        settleLettersLeft,
        consecutive,
        wordsLeft,
        paused: gameOver || !targetMessage,
        timing,
        choice,
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

    const offerKind = offer?.kind;
    const onAct = useCallback((action: StuckAction) => {
        report('taken', offerKind === 'choice' ? `choice:${action}` : action);
        accept();

        if (action === 'other_end') openOtherEnd();
        else if (action === 'letter' || action === 'clue') revealHint();
        else if (action === 'settle' || action === 'place') startSettle();
        else if (action === 'reveal') revealWord();
    }, [report, accept, offerKind, openOtherEnd, revealHint, revealWord, startSettle]);

    const prices = useMemo(() => {
        if (!settlePolicy.showPrices || offerKind !== 'choice' || !targetMessage) return undefined;
        return choicePrices(calculateMessageValue(targetMessage.content), settlePolicy);
    }, [settlePolicy, offerKind, targetMessage]);

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

    return { offer, prices, onAct, onReopen, onDismiss };
}
