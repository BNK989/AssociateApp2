'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ARRIVAL_STAGGER, MAX_DRIFTING_TILES, MAX_STAGGER_STEPS, SPAWN_SPRING } from './poolMotion';
import type { HaloPlacement } from '@/lib/letterPool/haloLayout';

type LetterHaloProps = {
    /**
     * Where each loose letter hangs. Solved by the composer rather than here,
     * because the flight needs the same angles to unwind them — one solve, one
     * answer, no chance of the chip and its flight disagreeing.
     */
    placements: HaloPlacement[];
    /**
     * Pool ids whose chip must not be visible: placed, or still flying home
     * after a backspace. They are **hidden, not unmounted** — an unmounted chip
     * has no rectangle, and the flight is measured after the commit that placed
     * the letter. It is also what a letter flies back to.
     */
    hidden: Set<string>;
    /** The target bubble. The halo is portalled into it, so it moves with it. */
    anchor: HTMLElement | null;
    /**
     * Puts this letter where it belongs, at the cost of any settled letter.
     *
     * It typed the letter at the caret at first, on the reasoning that a free
     * tap which dropped a letter into its true slot would give away the
     * answer's shape for nothing. True, and beside the point: the letters are
     * the word's own, so tapping one plainly *means* put it where it goes, and
     * a tap that did something else read as broken rather than as principled.
     * So it does the expected thing and charges the expected price — it is the
     * settle drip with a better gesture, not a second mechanic beside it.
     *
     * Takes the pool id, because the id carries the position; the character
     * alone could not say which of two identical letters was tapped.
     *
     * Absent when the word is not this player's to answer, which is also what
     * keeps the chips inert on someone else's turn in a room.
     */
    onPlace?: (poolId: string) => void;
};

/**
 * The letters the player has found but not placed, hung around the word itself.
 *
 * Portalled into the target bubble rather than measured against it. The bubble
 * is already `position: relative` and carries a stable id, so a child layer
 * with `inset: 0` gets its geometry for free and keeps it through every scroll,
 * resize and keyboard opening — no `ResizeObserver`, no scroll listener, and no
 * frame where the letters and the word disagree about where they are. The layer
 * does not clip: the bubble sets no `overflow`, so the arc spills into the free
 * column beside it exactly as `layoutHalo` intends.
 *
 * **There is no flight into the slot any more, and that is deliberate.** The
 * strip lives in the composer, the halo in the scrolling message list, and
 * framer's shared-layout projection across a scroll container reports stale
 * positions — the same trap that stopped the old pool flying up from the bubble.
 * A placed letter fades and shrinks where it hangs while its slot cell pops, at
 * the same moment. Two halves of one event, told in two places, with nothing
 * for the browser to get wrong.
 */
export function LetterHalo({ placements, hidden, anchor, onPlace }: LetterHaloProps) {
    const t = useTranslations('GameRoom.Pool');
    const reduced = Boolean(useReducedMotion());

    // Motion is a signal — "these letters have no place yet" — and every tile on
    // screen emitting it at once is noise as well as the densest case for the
    // compositor. A long phrase keeps its angles and loses the bob.
    const drifting = placements.length <= MAX_DRIFTING_TILES && !reduced;

    const arrival = useArrivalStagger(placements.map((placement) => placement.id));

    if (!anchor) return null;

    return createPortal(
        <div
            className="pointer-events-none absolute inset-0 z-20"
            aria-label={t('aria_label', { count: placements.length })}
        >
            <AnimatePresence initial={false}>
                {placements.map((placement) => (
                        <motion.div
                            key={placement.id}
                            className="absolute"
                            style={{
                                insetInlineStart: placement.inlineStart,
                                insetBlockStart: placement.blockStart,
                            }}
                            // x/y go through framer rather than a CSS transform,
                            // or animating `scale` would overwrite the centring.
                            // The offsets are added to the -50% that centres the
                            // chip on its spot, so the letter starts inside the
                            // bubble and travels out to its place.
                            initial={reduced
                                ? { x: '-50%', y: '-50%' }
                                : {
                                    x: `calc(-50% + ${placement.enterX}px)`,
                                    y: `calc(-50% + ${placement.enterY}px)`,
                                    rotate: placement.enterTwist,
                                    scale: 0.72,
                                    opacity: 0,
                                }}
                            animate={{ x: '-50%', y: '-50%', rotate: 0, scale: 1, opacity: 1 }}
                            exit={reduced ? { opacity: 0 } : { x: '-50%', y: '-50%', scale: 0.5, opacity: 0 }}
                            transition={reduced
                                ? { duration: 0 }
                                : { ...SPAWN_SPRING, delay: arrival.delayOf(placement.id) }}
                        >
                            <Chip
                                placement={placement}
                                drifting={drifting}
                                hidden={hidden.has(placement.id)}
                                onPlace={onPlace}
                            />
                        </motion.div>
                ))}
            </AnimatePresence>
        </div>,
        anchor,
    );
}

type ChipProps = {
    placement: HaloPlacement;
    drifting: boolean;
    hidden: boolean;
    onPlace?: (poolId: string) => void;
};

/**
 * One loose letter, tappable when the word is the player's to answer.
 *
 * A real button rather than a span with a handler, so it is reachable by
 * keyboard and announced as an action. That matters more here than usual: the
 * halo is the only place these letters exist on screen, and until now the only
 * way to spend one was to find the same key on a keyboard.
 *
 * The layer above is `pointer-events-none` so the message list still scrolls
 * everywhere the chips are not; the button turns them back on for itself alone.
 */
function Chip({ placement, drifting, hidden, onPlace }: ChipProps) {
    const t = useTranslations('GameRoom.Pool');

    const face = (
        <span
            // Measured by the flight, which needs to find this exact chip from
            // outside the component.
            id={`halo-${placement.id}`}
            // Everything the chip looks like lives in `.halo-letter`, because
            // the face, the cast shadow and the lit edge are one object and
            // splitting them across two files is how they drift apart.
            className={drifting ? 'halo-letter' : 'halo-letter halo-still'}
            style={{
                '--pool-tilt': `${placement.tilt}deg`,
                '--pool-phase': `-${placement.phase.toFixed(2)}s`,
                fontSize: `calc(1.05rem * ${placement.scale.toFixed(2)})`,
                // Hidden, not removed: it still has to be measurable, and it is
                // where the letter comes back to.
                visibility: hidden ? 'hidden' : 'visible',
            } as React.CSSProperties}
        >
            {placement.char}
        </span>
    );

    if (!onPlace) return face;

    return (
        <button
            type="button"
            // Keeps the mobile keyboard up, exactly as the composer's own
            // controls do. Losing it on a tap would cost more than the tap saves.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPlace(placement.id)}
            aria-label={t('place_letter', { letter: placement.char.toUpperCase() })}
            // A hidden chip is one already in flight or already placed; it must
            // stay measurable but must not be tappable twice.
            disabled={hidden}
            className="pointer-events-auto cursor-pointer rounded-full border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            {face}
        </button>
    );
}

/**
 * The target bubble's element, once it exists.
 *
 * A deferred lookup rather than a ref, because the composer and the bubble are
 * cousins: nothing in the tree hands one to the other, and the bubble mounts in
 * the same commit as the composer that wants it. `useBubbleWidth` already reads
 * the board this way for the same reason.
 */
export function useHaloAnchor(targetId?: string): HTMLElement | null {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);

    useEffect(() => {
        if (!targetId) {
            setAnchor(null);
            return;
        }

        const timeoutId = window.setTimeout(
            () => setAnchor(document.getElementById(`msg-bubble-${targetId}`)),
            0,
        );
        return () => window.clearTimeout(timeoutId);
    }, [targetId]);

    return anchor;
}

/**
 * When each letter of an arrival appears.
 *
 * A batch cascades; a lone letter does not wait. The delay is fixed the first
 * time a letter is seen and never recomputed, because a `transition` that
 * changes underneath a running animation is a rendering bug waiting to happen.
 *
 * The seen-set is rebuilt from the current letters each pass rather than added
 * to, so it cannot grow without bound and a new word starts a fresh cascade.
 *
 * The refs are written during render, which is safe here for the reason React
 * allows a memoisation cache to be: the pass is idempotent. A render that is
 * discarded and repeated recomputes `step` from zero and writes the same delays
 * back, and nothing outside this component can observe either ref.
 */
function useArrivalStagger(ids: string[]) {
    const seen = useRef(new Set<string>());
    const delays = useRef(new Map<string, number>());

    let step = 0;
    for (const id of ids) {
        if (seen.current.has(id)) continue;
        delays.current.set(id, Math.min(step, MAX_STAGGER_STEPS) * ARRIVAL_STAGGER);
        step += 1;
    }

    useEffect(() => {
        seen.current = new Set(ids);
        for (const id of delays.current.keys()) {
            if (!seen.current.has(id)) delays.current.delete(id);
        }
        // The ids are the dependency; their array identity changes every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ids.join(',')]);

    return { delayOf: (id: string) => delays.current.get(id) ?? 0 };
}
