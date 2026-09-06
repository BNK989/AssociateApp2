import { useEffect } from 'react';
import confetti from 'canvas-confetti';

const DURATION_MS = 3000;
const TICK_MS = 250;

const DEFAULTS = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

/**
 * The summary's firework, which now runs only when the day was worth one.
 *
 * It used to fire on every open, so a player who finished with an empty grid
 * got the same celebration as one who cleared the chain.
 */
export function useEndGameConfetti(active: boolean) {
    useEffect(() => {
        if (!active) return;

        const animationEnd = Date.now() + DURATION_MS;

        const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) {
                clearInterval(interval);
                return;
            }

            const particleCount = 50 * (timeLeft / DURATION_MS);
            // Particles fall, so they start above the viewport.
            confetti({ ...DEFAULTS, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...DEFAULTS, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, TICK_MS);

        return () => clearInterval(interval);
    }, [active]);
}
