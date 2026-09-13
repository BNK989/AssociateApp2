import { useEffect, useRef, useState } from 'react';

/**
 * The live pixel height of an element, for animating a box open around content
 * whose height nobody knows in advance.
 *
 * `height: auto` cannot be animated, and framer's `layout` prop animates the
 * box by *projecting* it — scaling the element and counter-scaling only the
 * children that opt in — which squashes plain text for the length of the
 * transition. Measuring instead gives the animation a real number to travel to,
 * and the content inside is never transformed at all.
 *
 * A `ResizeObserver` rather than a single measurement on mount, because the
 * content changes size after it appears: the clue panel opens around a
 * placeholder and grows when the clue itself lands, and that second change has
 * to ease exactly like the first.
 */
export function useMeasuredHeight<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const [height, setHeight] = useState<number | null>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        // Zero is read as "not measured yet" rather than as a height: an
        // element that has not been laid out (server render, a hidden parent,
        // a test environment with no layout engine) must fall back to `auto`
        // and stay open, not animate itself shut.
        const read = () => setHeight(element.getBoundingClientRect().height || null);
        read();

        if (typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver(read);
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return { ref, height };
}
