import { useEffect } from 'react';
import type { Message } from '@/hooks/useGameLogic';

/**
 * Delay before scrolling, so the board has committed the word that just moved.
 *
 * The chain re-renders as a word leaves it, and scrolling to an element that
 * has not been laid out yet lands on its old rectangle. A frame is not reliably
 * enough on a slow device; this is.
 */
const SETTLE_MS = 100;

/**
 * Keeps the word being guessed centred as the chain advances.
 *
 * Lifted out of `DailyGameClient` when that file reached the line cap. It is
 * the most self-contained thing in there — one effect, one DOM read, no game
 * state — and the board component is the wrong place for a scroll policy in any
 * case.
 *
 * It reads the element by id rather than holding a ref because the bubble is
 * rendered by `ChatArea`, several levels down, and threading a ref through for
 * one scroll would couple two components that otherwise share only the message
 * list. `useHaloAnchor` reaches the same element the same way for the same
 * reason.
 */
export function useScrollToTarget(targetMessage?: Message) {
    useEffect(() => {
        if (!targetMessage) return;
        const id = targetMessage.id;

        const timer = setTimeout(() => {
            document
                .getElementById(`msg-${id}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, SETTLE_MS);

        return () => clearTimeout(timer);
    }, [targetMessage]);
}
