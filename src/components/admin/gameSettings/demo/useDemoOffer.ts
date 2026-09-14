import { useCallback, useMemo } from 'react';
import type { Message } from '@/hooks/useGameLogic';
import { wordsInPlay } from '@/lib/daily/chainFronts';
import type { SettlePolicy } from '@/lib/daily/settlePolicy';
import { choicePrices, type StuckAction } from '@/lib/daily/stuckSignals';
import { calculateMessageValue } from '@/lib/gameLogic';
import { useStuckOffer } from '@/components/daily/useStuckOffer';

/**
 * The stuck ladder, wired for the panel's demo board.
 *
 * Deliberately not `useDailyStuckOffer`: that one reports every offer shown,
 * taken and waved away to the datalayer, and a game master rehearsing settings
 * must not pollute the A/B it is being tuned against. Everything that decides
 * *what* to offer is the same module the game runs, so the rehearsal cannot
 * disagree with the board.
 *
 * Two other differences, both properties of the demo chain rather than choices:
 * it has no second front to open, so `other_end` never has anything behind it;
 * and the clock can be pushed forward, because the alternative is a game master
 * sitting out the dwell in silence to see the fork they just composed.
 */

type UseDemoOfferArgs = {
    messages: Message[];
    targetMessage?: Message;
    canSettle: boolean;
    settleLettersLeft: number;
    consecutive: number;
    gameOver: boolean;
    /** The draft being edited, for the clock, the fork and the price quote. */
    settlePolicy: SettlePolicy;
    /** Dwell handed to the ladder by the skip-ahead control, in milliseconds. */
    creditMs: number;
    revealHint: () => void;
    /** Ends the word for nothing, which is what the reveal at the bottom does. */
    revealWord: () => void;
    startSettle: () => void;
};

export function useDemoOffer({
    messages,
    targetMessage,
    canSettle,
    settleLettersLeft,
    consecutive,
    gameOver,
    settlePolicy,
    creditMs,
    revealHint,
    revealWord,
    startSettle,
}: UseDemoOfferArgs) {
    const wordsLeft = useMemo(() => wordsInPlay(messages).length, [messages]);

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
        // The demo plays one straight chain, so there is no far side to enter
        // from. Passing false is what keeps the fork from ever showing a button
        // with nothing wired to it.
        canOpenOtherEnd: false,
        canSettle,
        settleLettersLeft,
        consecutive,
        wordsLeft,
        paused: gameOver || !targetMessage,
        timing,
        choice,
        creditMs,
    });

    const offerKind = offer?.kind;
    const onAct = useCallback((action: StuckAction) => {
        accept();

        if (action === 'letter' || action === 'clue') revealHint();
        else if (action === 'settle' || action === 'place') startSettle();
        else if (action === 'reveal') revealWord();
        // 'other_end' is the one action with nothing behind it here, and it is
        // unreachable for that reason: the ladder drops it before it is ever
        // offered, because the demo chain is passed canOpenOtherEnd: false.
    }, [accept, revealHint, revealWord, startSettle]);

    const prices = useMemo(() => {
        if (!settlePolicy.showPrices || offerKind !== 'choice' || !targetMessage) return undefined;
        return choicePrices(calculateMessageValue(targetMessage.content), settlePolicy);
    }, [settlePolicy, offerKind, targetMessage]);

    return { offer, prices, onAct, onDismiss: dismiss };
}
