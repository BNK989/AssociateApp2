import { useCallback, useState } from 'react';

/** How long the "+points" flourish stays on a solved word. */
const SOLVED_FLASH_MS = 1500;

/** Shake duration on a wrong guess. */
const SHAKE_MS = 500;

/**
 * The two transient flourishes a move produces: a shake on a wrong guess and a
 * "+points" flash on a right one.
 *
 * Both are presentation only and are never persisted, which is why they live
 * apart from the chain's own state.
 */
export function useMoveFeedback() {
    const [shakeMessageId, setShakeMessageId] = useState<string | null>(null);
    const [justSolvedData, setJustSolvedData] = useState<{ id: string; points: number } | null>(null);

    const flashSolved = useCallback((id: string, points: number) => {
        setJustSolvedData({ id, points });
        setTimeout(() => setJustSolvedData(null), SOLVED_FLASH_MS);
    }, []);

    const shakeWord = useCallback((id: string) => {
        setShakeMessageId(id);
        setTimeout(() => setShakeMessageId(null), SHAKE_MS);
    }, []);

    return { shakeMessageId, justSolvedData, flashSolved, shakeWord };
}
