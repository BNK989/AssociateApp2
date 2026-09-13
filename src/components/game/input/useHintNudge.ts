import { useEffect, useState } from 'react';
import type { GameState, Message } from '@/hooks/useGameLogic';

/** Idle time before the hint button quietly offers itself. */
const OFFER_AFTER_MS = 8000;

export type NudgeStage = 'idle' | 'offered';

/**
 * The hint button's own way of saying it is there.
 *
 * It used to jump, rotate and scale on a loop, escalating after fifteen seconds
 * into a harder jump — a control physically demanding attention from someone
 * who is thinking. That is the same message as "you are stuck", delivered by
 * the furniture, and it is the one thing the rest of this feature is built to
 * avoid saying: `stuckSignals.ts` states the rule as *the game offers, the
 * player never asks*, and an offer does not tug at a sleeve.
 *
 * What is left is a slow brand-toned breath: visible in peripheral vision,
 * ignorable, and it never escalates. The route out for a player who really is
 * stuck is the offer bar, which speaks in words and can be dismissed.
 */
export const nudgeVariants = {
    idle: { scale: 1, boxShadow: '0 0 0 0 rgba(0,0,0,0)' },
    offered: {
        scale: [1, 1.04, 1],
        boxShadow: [
            '0 0 0 0 var(--brand-subtle)',
            '0 0 0 6px rgba(0,0,0,0)',
            '0 0 0 0 rgba(0,0,0,0)',
        ],
        transition: { duration: 1.6, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' as const },
    },
};

type UseHintNudgeArgs = {
    game: GameState;
    targetMessage?: Message;
    isMaxHints: boolean;
    canAnswer: boolean;
    isAutoHintActive: boolean;
};

/**
 * Marks the hint button as available once a player has sat on a word for a
 * while. Resets whenever the target changes.
 *
 * Suppressed while auto-hint is running — there is no point pointing at
 * something that is about to happen on its own.
 */
export function useHintNudge({
    game,
    targetMessage,
    isMaxHints,
    canAnswer,
    isAutoHintActive,
}: UseHintNudgeArgs): NudgeStage {
    const [stage, setStage] = useState<NudgeStage>('idle');

    useEffect(() => {
        setStage('idle');

        const shouldOffer = game.status === 'solving'
            && Boolean(targetMessage)
            && !isMaxHints
            && canAnswer
            && !isAutoHintActive;

        if (!shouldOffer) return;

        const timer = setTimeout(() => setStage('offered'), OFFER_AFTER_MS);
        return () => clearTimeout(timer);
    }, [game.status, targetMessage, isMaxHints, canAnswer, isAutoHintActive]);

    return stage;
}
