import { useEffect, useRef, useState } from 'react';
import { findNewlyRevealedIndices } from './cipherRules';

/** How long a newly revealed letter keeps its flash. */
const FLASH_MS = 1000;

/**
 * Positions to flash because a bought hint just uncovered them.
 *
 * Compares each new mask against the previous one and reports only positions
 * that now show the real letter, so re-scrambling filler causes no flashes.
 */
export function useRevealFlash(
    cipherText: string | undefined,
    text: string,
    visible: boolean,
): Set<number> {
    const [flashing, setFlashing] = useState<Set<number>>(new Set());
    const previousCipherRef = useRef(cipherText || '');

    useEffect(() => {
        if (visible) return;

        const current = cipherText || '';
        if (current === previousCipherRef.current) return;

        const changed = findNewlyRevealedIndices(previousCipherRef.current, current, text);
        previousCipherRef.current = current;

        if (changed.size === 0) return;

        setFlashing(changed);
        const timer = setTimeout(() => setFlashing(new Set()), FLASH_MS);
        return () => clearTimeout(timer);
    }, [cipherText, visible, text]);

    return flashing;
}
