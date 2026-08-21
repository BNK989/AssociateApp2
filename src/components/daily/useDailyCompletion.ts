import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

/** Let the celebration play before the summary covers the board. */
const SUMMARY_DELAY_MS = 2000;

const TOTAL_PARTICLES = 200;

/** Overlapping bursts of differing spread and velocity, so it reads as one firework. */
const BURSTS: Array<{ ratio: number; opts: confetti.Options }> = [
    { ratio: 0.25, opts: { spread: 26, startVelocity: 55 } },
    { ratio: 0.2, opts: { spread: 60 } },
    { ratio: 0.35, opts: { spread: 100, decay: 0.91, scalar: 0.8 } },
    { ratio: 0.1, opts: { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 } },
    { ratio: 0.1, opts: { spread: 120, startVelocity: 45 } },
];

function celebrate() {
    for (const { ratio, opts } of BURSTS) {
        confetti({
            origin: { y: 0.7 },
            ...opts,
            particleCount: Math.floor(TOTAL_PARTICLES * ratio),
        });
    }
}

/**
 * Fires confetti when the chain is finished, then reveals the summary.
 *
 * A game restored from storage as already-complete opens the summary straight
 * away, without replaying the celebration.
 */
export function useDailyCompletion(gameOver: boolean, alreadyComplete: boolean) {
    const [showSummary, setShowSummary] = useState(alreadyComplete);

    useEffect(() => {
        if (!gameOver || showSummary) return;

        celebrate();
        const timer = setTimeout(() => setShowSummary(true), SUMMARY_DELAY_MS);
        return () => clearTimeout(timer);
    }, [gameOver, showSummary]);

    return { showSummary, setShowSummary };
}
