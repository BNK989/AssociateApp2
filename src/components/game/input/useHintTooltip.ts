import { useCallback, useEffect, useState } from 'react';
import type { GameState, Message } from '@/hooks/useGameLogic';

/** Shown once ever, across all games, not once per game. */
const STORAGE_KEY = 'associ8-hint-tooltip-seen';

/** How long a player may sit on a word before the hint button is pointed out. */
const REVEAL_AFTER_MS = 5000;

type UseHintTooltipArgs = {
    game: GameState;
    targetMessage?: Message;
    isMaxHints: boolean;
};

/**
 * One-time nudge toward the hint button for players who have not found it.
 *
 * It appears only if the player has been idle on a solvable word, and any
 * interaction anywhere in the input area dismisses it permanently — a player
 * who is already using the controls does not need telling.
 */
export function useHintTooltip({ game, targetMessage, isMaxHints }: UseHintTooltipArgs) {
    const [isOpen, setIsOpen] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [hasSeen, setHasSeen] = useState(false);

    useEffect(() => {
        if (localStorage.getItem(STORAGE_KEY)) {
            setHasSeen(true);
            return;
        }

        if (game.status !== 'solving' || !targetMessage || isMaxHints) return;

        const timer = setTimeout(() => {
            if (hasInteracted) return;
            setIsOpen(true);
            localStorage.setItem(STORAGE_KEY, 'true');
            setHasSeen(true);
        }, REVEAL_AFTER_MS);

        return () => clearTimeout(timer);
    }, [game.status, targetMessage, isMaxHints, hasInteracted]);

    const markInteracted = useCallback(() => {
        if (!hasSeen) {
            localStorage.setItem(STORAGE_KEY, 'true');
            setHasSeen(true);
        }
        if (!hasInteracted) {
            setHasInteracted(true);
            setIsOpen(false);
        }
    }, [hasSeen, hasInteracted]);

    return { isOpen, setIsOpen, hasSeen, markInteracted };
}
