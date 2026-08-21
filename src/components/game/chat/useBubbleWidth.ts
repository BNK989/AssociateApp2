import { useEffect, useState } from 'react';
import type { GameState, Message } from '@/hooks/useGameLogic';

/**
 * Tracks the rendered width of the active solve target's bubble.
 *
 * The connection-score indicator uses this to drop its text label on narrow
 * bubbles, where the label would overflow the word it annotates.
 */
export function useBubbleWidth(game: GameState, targetMessage?: Message): number {
    const [width, setWidth] = useState(0);

    useEffect(() => {
        if (game.status !== 'solving' || !targetMessage?.id) return;

        const bubbleId = `msg-bubble-${targetMessage.id}`;
        let observer: ResizeObserver | undefined;

        // Defer a tick so the bubble exists before we measure it.
        const timeoutId = setTimeout(() => {
            const el = document.getElementById(bubbleId);
            if (!el) return;

            setWidth(el.offsetWidth);

            observer = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    // borderBoxSize matches offsetWidth (includes padding and border).
                    if (entry.borderBoxSize?.length) {
                        setWidth(entry.borderBoxSize[0].inlineSize);
                    } else {
                        setWidth((entry.target as HTMLElement).offsetWidth);
                    }
                }
            });
            observer.observe(el);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            observer?.disconnect();
        };
    }, [targetMessage?.id, game.status]);

    return width;
}
