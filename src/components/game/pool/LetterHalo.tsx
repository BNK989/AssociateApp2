'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { layoutHalo } from '@/lib/letterPool/haloLayout';
import { MAX_DRIFTING_TILES, SPAWN_SPRING } from './poolMotion';
import type { PoolLetter } from '@/lib/letterPool/poolRules';

type LetterHaloProps = {
    letters: PoolLetter[];
    /** Pool ids currently sitting in a slot; they leave the halo. */
    placed: Set<string>;
    /** The target bubble. The halo is portalled into it, so it moves with it. */
    anchor: HTMLElement | null;
    /** True when the target is the player's own message, on the other side. */
    mirror: boolean;
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
export function LetterHalo({ letters, placed, anchor, mirror }: LetterHaloProps) {
    const t = useTranslations('GameRoom.Pool');
    const reduced = Boolean(useReducedMotion());
    const placements = useMemo(() => layoutHalo(letters, mirror), [letters, mirror]);

    // Motion is a signal — "these letters have no place yet" — and every tile on
    // screen emitting it at once is noise as well as the densest case for the
    // compositor. A long phrase keeps its angles and loses the bob.
    const drifting = letters.length <= MAX_DRIFTING_TILES && !reduced;

    if (!anchor) return null;

    return createPortal(
        <div
            className="pointer-events-none absolute inset-0 z-20"
            aria-label={t('aria_label', { count: letters.length })}
        >
            <AnimatePresence initial={false}>
                {placements.map((placement, order) => (
                    placed.has(placement.id) ? null : (
                        <motion.div
                            key={placement.id}
                            className="absolute"
                            style={{
                                insetInlineStart: placement.inlineStart,
                                insetBlockStart: placement.blockStart,
                            }}
                            // x/y go through framer rather than a CSS transform,
                            // or animating `scale` would overwrite the centring.
                            initial={reduced ? { x: '-50%', y: '-50%' } : { x: '-50%', y: '-50%', scale: 0.4, opacity: 0 }}
                            animate={{ x: '-50%', y: '-50%', scale: 1, opacity: 1 }}
                            exit={reduced ? { opacity: 0 } : { x: '-50%', y: '-50%', scale: 0.5, opacity: 0 }}
                            transition={reduced ? { duration: 0 } : { ...SPAWN_SPRING, delay: order * 0.04 }}
                        >
                            <span
                                className={`block font-bold leading-none text-[var(--tile-present)] drop-shadow-[0_0_3px_var(--tile-glow)] ${
                                    drifting ? 'halo-letter' : 'halo-letter halo-still'
                                }`}
                                style={{
                                    '--pool-tilt': `${placement.tilt}deg`,
                                    '--pool-phase': `-${placement.phase.toFixed(2)}s`,
                                    fontSize: `calc(1rem * ${placement.scale.toFixed(2)})`,
                                } as React.CSSProperties}
                            >
                                {placement.char}
                            </span>
                        </motion.div>
                    )
                ))}
            </AnimatePresence>
        </div>,
        anchor,
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
