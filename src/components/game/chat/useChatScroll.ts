import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { GameState, Message } from '@/hooks/useGameLogic';

type UseChatScrollArgs = {
    containerRef: RefObject<HTMLDivElement | null>;
    messages: Message[];
    game: GameState;
    targetMessage?: Message;
    justSolvedData?: { id: string; points: number } | null;
};

/**
 * Keeps the chat scrolled to the right place for the current phase.
 *
 * Scrolling is deliberately restricted to *structural* changes — a new message,
 * a new solve target, or a phase change. Without that whitelist the view would
 * jump on every incidental update (hint bought, strike added, points awarded).
 */
export function useChatScroll({
    containerRef,
    messages,
    game,
    targetMessage,
    justSolvedData,
}: UseChatScrollArgs) {
    const scrollToSmart = useCallback(() => {
        if (!containerRef.current) return;

        // Small timeout to ensure DOM is ready
        setTimeout(() => {
            if (!containerRef.current) return;

            if (game.status === 'solving' && targetMessage) {
                const targetEl = document.getElementById(`msg-${targetMessage.id}`);
                const solvedEl = justSolvedData?.id
                    ? document.getElementById(`msg-${justSolvedData.id}`)
                    : null;

                if (!targetEl) return;

                // Position the target at the bottom of the visible area, above the input.
                const bottomPadding = 20;
                let elementBottom = targetEl.offsetTop + targetEl.offsetHeight;

                // When the just-solved message sits below the target (the usual case
                // when solving bottom-up), keep it in view so the player can see the
                // word they just got.
                if (solvedEl && solvedEl.offsetTop > targetEl.offsetTop) {
                    elementBottom = solvedEl.offsetTop + solvedEl.offsetHeight;
                }

                containerRef.current.scrollTo({
                    top: elementBottom - containerRef.current.clientHeight + bottomPadding,
                    behavior: 'smooth',
                });
                return;
            }

            if (game.status === 'completed') {
                // Land on the last word revealed, or the final message after a reload.
                const focusId = justSolvedData?.id
                    ?? (messages.length > 0 ? messages[messages.length - 1].id : null);
                if (!focusId) return;

                document
                    .getElementById(`msg-${focusId}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            // Texting mode: stay pinned to the bottom.
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }, 100);
    }, [containerRef, game.status, targetMessage, justSolvedData, messages]);

    const prevTargetIdRef = useRef<string | undefined>(undefined);
    const prevMessagesLengthRef = useRef(messages.length);
    const prevGameStatusRef = useRef(game.status);

    useEffect(() => {
        const isNewMessage = messages.length > prevMessagesLengthRef.current;
        const isTargetChange = targetMessage?.id !== prevTargetIdRef.current;
        const isStatusChange = game.status !== prevGameStatusRef.current;

        prevMessagesLengthRef.current = messages.length;
        prevTargetIdRef.current = targetMessage?.id;
        prevGameStatusRef.current = game.status;

        if (isNewMessage || isTargetChange || isStatusChange) {
            scrollToSmart();
        }
    }, [messages, game.status, targetMessage, scrollToSmart]);

    // Re-anchor when the visual viewport shrinks (mobile keyboard opening).
    useEffect(() => {
        if (!window.visualViewport) return;

        const handleResize = () => scrollToSmart();
        window.visualViewport.addEventListener('resize', handleResize);
        return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }, [scrollToSmart]);
}
