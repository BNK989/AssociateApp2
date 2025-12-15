import { useState, useEffect } from 'react';

/**
 * Hook to get the accurate visual viewport height.
 * This is crucial for mobile interactions where the keyboard or address bar
 * changes the visible area, and standard vh/dvh units might not update
 * consistently or with the desired behavior.
 */
export function useVisualViewport() {
    const [viewportHeight, setViewportHeight] = useState<number | string>('100dvh');

    useEffect(() => {
        // Only run on client
        if (typeof window === 'undefined') return;

        const handleResize = () => {
            if (window.visualViewport) {
                // visualViewport.height excludes the keyboard and address bar when they encroach
                setViewportHeight(window.visualViewport.height);
            } else {
                // Fallback for browsers without visualViewport support
                setViewportHeight(window.innerHeight);
            }
        };

        // Initial set
        handleResize();

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
            // Sometimes scroll events can accompany viewport changes on some mobile browsers
            window.visualViewport.addEventListener('scroll', handleResize);
        } else {
            window.addEventListener('resize', handleResize);
        }

        return () => {
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleResize);
                window.visualViewport.removeEventListener('scroll', handleResize);
            } else {
                window.removeEventListener('resize', handleResize);
            }
        };
    }, []);

    return viewportHeight;
}
