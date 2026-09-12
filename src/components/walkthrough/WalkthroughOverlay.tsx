'use client';

import { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform, type MotionValue } from 'framer-motion';
import type { Box } from './placement';

/** Breathing room between the cutout and the element inside it. */
const PAD = 8;

/** Corner radius of the cutout, matched to the app's `--radius-lg`. */
const RADIUS = 10;

/**
 * Size of the scrim rectangle, in user units.
 *
 * Deliberately far larger than any viewport instead of `window.innerWidth`:
 * reading the window during render is not SSR-safe and went stale on rotation,
 * and the SVG clips the overflow anyway. One less thing to keep in sync.
 */
const SCREEN = 10_000;

const SPRING = { stiffness: 220, damping: 30, mass: 0.6 } as const;

/**
 * A rounded rectangle punched out of the scrim, as one SVG path.
 *
 * One path rather than a mask so that `fill-rule: evenodd` makes the hole a
 * real hole: clicks inside it reach the board, and a player can try the control
 * being described while it is being described. A mask would paint the same
 * picture and swallow the clicks.
 */
export function cutoutPath(x: number, y: number, w: number, h: number): string {
    const screen = `M0,0 H${SCREEN} V${SCREEN} H0 Z`;
    if (w <= 0 || h <= 0) return screen;

    // A radius larger than half the box turns the corners inside out.
    const r = Math.min(RADIUS, w / 2, h / 2);

    const hole = [
        `M${x + r},${y}`,
        `H${x + w - r}`, `A${r},${r} 0 0 1 ${x + w},${y + r}`,
        `V${y + h - r}`, `A${r},${r} 0 0 1 ${x + w - r},${y + h}`,
        `H${x + r}`, `A${r},${r} 0 0 1 ${x},${y + h - r}`,
        `V${y + r}`, `A${r},${r} 0 0 1 ${x + r},${y}`,
        'Z',
    ].join(' ');

    return `${screen} ${hole}`;
}

/**
 * Drives the four numbers the cutout is built from.
 *
 * Springs on the *geometry* rather than on the path string: interpolating two
 * `d` strings needs them to have identical command sequences, which is exactly
 * the kind of invariant that breaks the first time a corner radius clamps. The
 * first target of a tour jumps into place -- animating it from nothing would
 * read as the hole flying in from the top left corner.
 */
function useCutoutBox(rect: Box | null): MotionValue<string> {
    const x = useSpring(0, SPRING);
    const y = useSpring(0, SPRING);
    const width = useSpring(0, SPRING);
    const height = useSpring(0, SPRING);

    const placed = useRef(false);

    useEffect(() => {
        if (!rect) {
            placed.current = false;
            width.jump(0);
            height.jump(0);
            return;
        }

        const next = [rect.left - PAD, rect.top - PAD, rect.width + PAD * 2, rect.height + PAD * 2];
        const values = [x, y, width, height];

        values.forEach((value, index) => {
            if (placed.current) {
                value.set(next[index]);
            } else {
                value.jump(next[index]);
            }
        });

        placed.current = true;
    }, [rect, x, y, width, height]);

    return useTransform([x, y, width, height], ([lx, ly, lw, lh]: number[]) => cutoutPath(lx, ly, lw, lh));
}

type WalkthroughOverlayProps = {
    /** The element being highlighted, or null to dim the whole screen. */
    rect: Box | null;
    onClickOutside?: () => void;
};

/** The scrim, with a hole where the step's subject is. */
export function WalkthroughOverlay({ rect, onClickOutside }: WalkthroughOverlayProps) {
    const d = useCutoutBox(rect);

    return (
        <motion.div
            className="fixed inset-0 z-50 overflow-hidden pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
        >
            <svg width="100%" height="100%" className="absolute inset-0 text-brand">
                <motion.path
                    d={d}
                    fill="rgba(0, 0, 0, 0.62)"
                    fillRule="evenodd"
                    className="pointer-events-auto"
                    onClick={onClickOutside}
                />

                {rect && (
                    <motion.rect
                        x={rect.left - PAD}
                        y={rect.top - PAD}
                        width={rect.width + PAD * 2}
                        height={rect.height + PAD * 2}
                        animate={{
                            x: rect.left - PAD,
                            y: rect.top - PAD,
                            width: rect.width + PAD * 2,
                            height: rect.height + PAD * 2,
                        }}
                        transition={{ type: 'spring', ...SPRING }}
                        rx={RADIUS}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        className="pointer-events-none"
                    />
                )}
            </svg>
        </motion.div>
    );
}
