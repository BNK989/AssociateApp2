import { useEffect, useState } from 'react';
import type { GameState, Message } from '@/hooks/useGameLogic';

/** Idle time before the hint button starts moving, then before it insists. */
const GENTLE_AFTER_MS = 5000;
const INTENSE_AFTER_MS = 15000;

export type NudgeStage = 'idle' | 'gentle' | 'intense';

/** Escalating jump-and-vibrate for the hint button. */
export const nudgeVariants = {
    idle: { y: 0, x: 0, rotate: 0 },
    gentle: {
        y: [0, -4, 0, -2, 0],
        x: [0, -1, 1, -1, 0],
        rotate: [0, -2, 2, -1, 0],
        transition: { duration: 0.6, repeat: Infinity, repeatDelay: 3 },
    },
    intense: {
        y: [0, -8, 0, -4, 0],
        x: [0, -3, 3, -2, 2, 0],
        rotate: [0, -5, 5, -3, 3, 0],
        scale: [1, 1.1, 1, 1.1, 1],
        transition: { duration: 0.5, repeat: Infinity, repeatDelay: 3 },
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
 * Draws attention to the hint button when a player appears stuck, escalating
 * the longer they sit on the word. Resets whenever the target changes.
 *
 * Suppressed while auto-hint is running — there is no point nudging toward
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

        const shouldNudge = game.status === 'solving'
            && Boolean(targetMessage)
            && !isMaxHints
            && canAnswer
            && !isAutoHintActive;

        if (!shouldNudge) return;

        const gentle = setTimeout(() => setStage('gentle'), GENTLE_AFTER_MS);
        const intense = setTimeout(() => setStage('intense'), INTENSE_AFTER_MS);

        return () => {
            clearTimeout(gentle);
            clearTimeout(intense);
        };
    }, [game.status, targetMessage, isMaxHints, canAnswer, isAutoHintActive]);

    return stage;
}
