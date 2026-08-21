import { useEffect, useRef, useState } from 'react';
import { countUpFrame, countUpStepSize } from './headerRules';

/** Milliseconds between frames. ~33fps, fast enough to read as motion. */
const FRAME_MS = 30;

/**
 * Animates a number toward `target` instead of snapping to it, so a score or
 * pot change reads as a tick-up rather than a jump.
 *
 * The first value is adopted immediately — landing in a game mid-way through
 * should show the real score, not count up to it from zero.
 */
export function useCountUp(target: number): number {
    const [display, setDisplay] = useState(target);
    const hasInitialised = useRef(false);

    useEffect(() => {
        if (!hasInitialised.current) {
            hasInitialised.current = true;
            setDisplay(target);
            return;
        }

        if (display === target) return;

        // Fixed for the whole run, so the count moves at a constant rate.
        const step = countUpStepSize(display, target);
        const timer = setInterval(() => {
            setDisplay((prev) => {
                const next = countUpFrame(prev, target, step);
                if (next === target) clearInterval(timer);
                return next;
            });
        }, FRAME_MS);

        return () => clearInterval(timer);
        // `display` drives re-arming the interval after each committed frame.
    }, [target, display]);

    return display;
}
