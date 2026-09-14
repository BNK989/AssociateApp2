import { useEffect, useRef, useState } from 'react';

type MeasuredSize = { width: number | null; height: number | null };

const UNMEASURED: MeasuredSize = { width: null, height: null };

/**
 * The live pixel size of an element, for animating a box around content whose
 * size nobody knows in advance.
 *
 * `width: auto` and `height: auto` cannot be animated, and framer's `layout`
 * prop animates the box by *projecting* it -- scaling the element and
 * counter-scaling only the children that opt in -- which squashes plain text
 * for the length of the transition. Measuring instead gives the animation a
 * real number to travel to, and the content inside is never transformed at all.
 *
 * A `ResizeObserver` rather than a single measurement on mount, because the
 * content changes size after it appears: the clue panel opens around a
 * placeholder and grows when the clue itself lands, and the bubble widens when
 * the panel joins it, and every one of those changes has to ease exactly like
 * the first.
 */
export function useMeasuredSize<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const [size, setSize] = useState<MeasuredSize>(UNMEASURED);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        // Zero is read as "not measured yet" rather than as a size: an element
        // that has not been laid out (server render, a hidden parent, a test
        // environment with no layout engine) must fall back to `auto` and stay
        // open, not animate itself shut.
        const read = () => {
            const rect = element.getBoundingClientRect();
            const width = rect.width || null;
            const height = rect.height || null;
            setSize((prev) => (prev.width === width && prev.height === height
                ? prev
                : { width, height }));
        };
        read();

        if (typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver(read);
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return { ref, width: size.width, height: size.height };
}
