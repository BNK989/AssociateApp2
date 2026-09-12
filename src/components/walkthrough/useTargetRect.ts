import { useEffect, useState } from 'react';
import type { Box } from './placement';

/**
 * Tracks the box of the element a step points at.
 *
 * The overlay and the card both need it, and each used to measure the DOM for
 * itself -- twice per frame, from two `setInterval(…, 500)` polls that ran for
 * the life of the tour. That is jank on a phone, and it made the highlight and
 * the card disagree for up to half a second whenever the board moved under
 * them.
 *
 * Measured once here and handed to both. A `ResizeObserver` covers the element
 * changing size, capture-phase scroll covers every scroll container between it
 * and the window (the message list is one), and a `MutationObserver` on the
 * subtree covers a target that is replaced rather than moved -- a bubble
 * re-rendering as its word is solved.
 */
export function useTargetRect(targetId: string): Box | null {
    const [rect, setRect] = useState<Box | null>(null);

    useEffect(() => {
        if (!targetId) {
            setRect(null);
            return;
        }

        let frame = 0;
        let last = '';

        const measure = () => {
            frame = 0;

            const element = document.getElementById(targetId);
            if (!element) {
                last = '';
                setRect(null);
                return;
            }

            const { top, left, width, height } = element.getBoundingClientRect();
            const next = `${top}|${left}|${width}|${height}`;

            // Compared before setting: a scroll that does not move the target
            // should not re-render the overlay on every frame of it.
            if (next === last) return;
            last = next;
            setRect({ top, left, width, height });
        };

        const schedule = () => {
            if (frame) return;
            frame = requestAnimationFrame(measure);
        };

        measure();

        const element = document.getElementById(targetId);
        const resizeObserver = new ResizeObserver(schedule);
        if (element) resizeObserver.observe(element);

        const mutationObserver = new MutationObserver(schedule);
        mutationObserver.observe(document.body, { childList: true, subtree: true });

        window.addEventListener('resize', schedule);
        window.addEventListener('scroll', schedule, true);

        return () => {
            if (frame) cancelAnimationFrame(frame);
            resizeObserver.disconnect();
            mutationObserver.disconnect();
            window.removeEventListener('resize', schedule);
            window.removeEventListener('scroll', schedule, true);
        };
    }, [targetId]);

    return rect;
}

/**
 * Brings a step's target into view before it is pointed at.
 *
 * Nothing did this before, so a step anchored to something scrolled out of the
 * message list highlighted a box off the top of the screen and put its card
 * next to it. `block: 'center'` rather than `nearest` because the card needs
 * room on one side of the target, and the middle of the viewport is the only
 * position that guarantees it.
 */
export function scrollTargetIntoView(targetId: string) {
    if (!targetId) return;

    const element = document.getElementById(targetId);
    if (!element) return;

    element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
}
