import { useCallback, useRef } from 'react';
import type { Message } from '@/hooks/useGameLogic';

/** Per-character delay while the opening word types itself out. */
const TYPE_INTERVAL_MS = 50;

/** Beat between the word finishing and it being accepted. */
const SOLVE_DELAY_MS = 300;

type UseStartWordAnimationArgs = {
    messages: Message[];
    startWord?: string;
    setInput: (value: string) => void;
    onSolved: (messageId: string) => void;
};

/**
 * Types the free opening word into the input and submits it, so a new player
 * sees the mechanic demonstrated before their first turn.
 *
 * Skipped when the word is already solved — a returning player should not
 * watch it replay.
 */
export function useStartWordAnimation({
    messages,
    startWord,
    setInput,
    onSolved,
}: UseStartWordAnimationArgs) {
    const timersRef = useRef<NodeJS.Timeout[]>([]);

    return useCallback(() => {
        const startMessage = messages.find((m) => m.content === startWord);
        if (!startMessage || startMessage.is_solved) return;

        const text = startMessage.content;
        let index = 0;

        const typeTimer = setInterval(() => {
            if (index < text.length) {
                setInput(text.slice(0, index + 1));
                index++;
                return;
            }

            clearInterval(typeTimer);

            const solveTimer = setTimeout(() => {
                onSolved(startMessage.id);
                setInput('');
            }, SOLVE_DELAY_MS);

            timersRef.current.push(solveTimer);
        }, TYPE_INTERVAL_MS);

        timersRef.current.push(typeTimer);
    }, [messages, startWord, setInput, onSolved]);
}
