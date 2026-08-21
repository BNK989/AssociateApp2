import { useEffect, useRef } from 'react';
import type { GameState } from '@/hooks/useGameLogic';

const CONFETTI_DURATION_MS = 1000;
const CONFETTI_COLORS = ['#bb0000', '#ffffff', '#0000ff'];

/**
 * Fires confetti from both edges when the game *transitions* into solving mode.
 * Loading straight into a game that is already solving does not celebrate.
 */
export function useSolvingConfetti(game: GameState) {
    const prevStatusRef = useRef(game.status);

    useEffect(() => {
        if (game.status === 'solving' && prevStatusRef.current !== 'solving') {
            import('canvas-confetti').then((confetti) => {
                const end = Date.now() + CONFETTI_DURATION_MS;

                (function frame() {
                    confetti.default({
                        particleCount: 5, angle: 60, spread: 55,
                        origin: { x: 0 }, colors: CONFETTI_COLORS,
                    });
                    confetti.default({
                        particleCount: 5, angle: 120, spread: 55,
                        origin: { x: 1 }, colors: CONFETTI_COLORS,
                    });

                    if (Date.now() < end) requestAnimationFrame(frame);
                })();
            });
        }

        prevStatusRef.current = game.status;
    }, [game.status]);
}
