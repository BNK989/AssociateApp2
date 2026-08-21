import { useEffect, useRef, useState } from 'react';

/** How long the theme sits centre-screen before docking into the header. */
const WELCOME_DISPLAY_MS = 2500;

/** Grace period for the layout animation to settle before handing control back. */
const SETTLE_MS = 500;

/**
 * Shows the daily puzzle's theme centre-screen on entry, then hands off to the
 * header where it docks via a shared layout animation.
 *
 * Suppressed while the tutorial is running, so the two overlays never stack.
 */
export function useWelcomeOverlay(
    theme: string | undefined,
    showTutorial: boolean | undefined,
    onComplete?: () => void,
): boolean {
    const [showWelcome, setShowWelcome] = useState(false);

    // Held in a ref so a changing callback does not restart the timer.
    const onCompleteRef = useRef(onComplete);
    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
        if (!theme) return;

        if (showTutorial) {
            setShowWelcome(false);
            return;
        }

        setShowWelcome(true);

        const timer = setTimeout(() => {
            setShowWelcome(false);
            setTimeout(() => onCompleteRef.current?.(), SETTLE_MS);
        }, WELCOME_DISPLAY_MS);

        return () => clearTimeout(timer);
    }, [theme, showTutorial]);

    return showWelcome;
}
