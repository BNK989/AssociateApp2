'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import type { Flight } from './useLetterFlights';

type LetterFlightProps = {
    flights: Flight[];
    onLand: (key: string) => void;
};

/**
 * The letters currently in the air, drawn above everything.
 *
 * One consequence of portalling to the body: the bubble's own `--tile-*` scope
 * is left behind, so a flying letter takes the theme's default tile palette
 * rather than the surface it launched from. That is the right colour for every
 * target a player actually solves — those are other people's messages, on the
 * peer surface the defaults describe.
 *
 * A fixed layer on `document.body`, which is the point: the halo lives in the
 * scrolling message list and the strip in the composer, and a flight that
 * belonged to either would be measured against a moving containing block. Here
 * there is no containing block and no scroll parent — the path is viewport
 * coordinates and the element is pinned to them.
 *
 * Each flight is two layers. The **skin** is the keycap — face, border, cast
 * shadow — and it dissolves over the second half, so the letter arrives as
 * strip text rather than as a chip dropped on top of one. The **glyph** rides
 * all the way, which is what makes it one letter moving rather than one
 * disappearing and another appearing.
 */
export function LetterFlight({ flights, onLand }: LetterFlightProps) {
    const [root, setRoot] = useState<HTMLElement | null>(null);

    // Body is not there to portal into until the client has mounted.
    useEffect(() => setRoot(document.body), []);

    if (!root || flights.length === 0) return null;

    return createPortal(
        <div className="pointer-events-none fixed inset-0 z-[90]" aria-hidden="true">
            {flights.map((flight) => (
                <FlyingLetter key={flight.key} flight={flight} onLand={onLand} />
            ))}
        </div>,
        root,
    );
}

function FlyingLetter({ flight, onLand }: { flight: Flight; onLand: (key: string) => void }) {
    const { path } = flight;
    const seconds = path.durationMs / 1000;

    return (
        <>
        <motion.span
            // What the chip leaves behind: its outline, fading where it stood.
            // Without it the letter's departure has no cause — something simply
            // appears in mid-air and travels.
            className="halo-skin halo-ghost absolute"
            style={{
                left: path.left,
                top: path.top,
                width: path.width,
                height: path.height,
                fontSize: path.height / 1.85,
            }}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ duration: path.ghostMs / 1000, ease: 'easeOut' }}
        />

        <motion.div
            className="absolute grid place-items-center"
            style={{
                left: path.left,
                top: path.top,
                width: path.width,
                height: path.height,
                // The chip is 1.85em tall by construction, so its height is the
                // only measurement needed to recover the type size — and with
                // it, the em-based radius and border of the skin.
                fontSize: path.height / 1.85,
                // Scale and rotation act about the letter, so the centres of the
                // two ends are what the path has to line up — not their corners.
                transformOrigin: 'center',
            }}
            initial={{ x: 0, y: 0, scale: 1, rotate: path.rotate[0] }}
            animate={{
                x: path.x,
                y: path.y,
                scale: path.scale,
                rotate: path.rotate,
            }}
            transition={{
                // Position is pre-eased into its samples, so it plays back
                // linearly. Handing framer a curve for a keyframe array applies
                // it between every pair, and fourteen segments stutter fourteen
                // times.
                x: { duration: seconds, ease: 'linear' },
                y: { duration: seconds, ease: 'linear' },
                scale: { duration: seconds, times: path.scaleTimes, ease: 'easeOut' },
                rotate: { duration: seconds, times: path.rotateTimes, ease: 'easeOut' },
            }}
            onAnimationComplete={() => onLand(flight.key)}
        >
            <motion.span
                // The keycap, dissolving. Separate from the glyph so the letter
                // itself never fades — only the thing it was sitting in.
                className="halo-skin"
                initial={{ opacity: 1 }}
                animate={{ opacity: path.skin }}
                transition={{ duration: seconds, times: path.skinTimes, ease: 'easeIn' }}
            />

            <span className="relative font-bold uppercase leading-none text-[var(--tile-present)]">
                {flight.char}
            </span>
        </motion.div>
        </>
    );
}
