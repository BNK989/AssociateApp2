import { useCallback, useState } from 'react';
import type { JustSolved, SolveFeedback } from '@/lib/daily/feedbackTiers';

/** How long the "+points" flourish stays on a solved word. */
const SOLVED_FLASH_MS = 1500;

/** Shake duration on a wrong guess. */
const SHAKE_MS = 500;

/**
 * The two transient flourishes a move produces: a shake on a wrong guess and a
 * graded "+points" burst on a right one.
 *
 * Both are presentation only and are never persisted, which is why they live
 * apart from the chain's own state. The grade rides along with the points so
 * the burst and the chime are driven from one decision rather than each
 * re-deriving how good the solve was.
 */
export function useMoveFeedback() {
    const [shakeMessageId, setShakeMessageId] = useState<string | null>(null);
    const [justSolvedData, setJustSolvedData] = useState<JustSolved | null>(null);

    const flashSolved = useCallback((id: string, points: number, feedback?: SolveFeedback) => {
        setJustSolvedData({ id, points, feedback });
        setTimeout(() => setJustSolvedData(null), SOLVED_FLASH_MS);
    }, []);

    const shakeWord = useCallback((id: string) => {
        setShakeMessageId(id);
        setTimeout(() => setShakeMessageId(null), SHAKE_MS);
    }, []);

    return { shakeMessageId, justSolvedData, flashSolved, shakeWord };
}
