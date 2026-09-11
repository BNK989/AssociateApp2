import type { Transition } from 'framer-motion';
import type { CSSProperties } from 'react';
import { seedFromId } from '@/lib/letterPool/poolRules';

/**
 * How the pool and the slot strip move.
 *
 * One module so the two halves of the same gesture cannot drift apart, and so
 * every value below can be read against the rule it serves.
 *
 * The rules, in the order they matter:
 *
 * 1. **Only `transform` and `opacity` animate.** Anything that changes layout —
 *    width, height, margin — is a reflow per frame and will never be smooth on
 *    a mid-range phone. This is why a placed tile leaves its socket behind
 *    rather than being removed from the pool: the row must not reflow.
 * 2. **Springs, not durations.** A spring retargets from its current velocity,
 *    so a player typing faster than the animation never queues a backlog and
 *    never sees a tile snap. A duration-and-easing tween cannot do that.
 * 3. **Drift is CSS, not JavaScript.** A framer `repeat: Infinity` keeps a JS
 *    loop alive per tile; the board already pays that for every masked word.
 *    The pool's idle motion is a CSS keyframe instead, which the compositor
 *    runs without waking the main thread.
 */

/** Drawing a letter out of the pool and into its slot. The headline gesture. */
export const PLACE_SPRING: Transition = {
    type: 'spring',
    stiffness: 420,
    damping: 34,
    mass: 0.9,
};

/** The landing: a short, tight overshoot that reads as the letter seating. */
export const SETTLE_SPRING: Transition = {
    type: 'spring',
    stiffness: 620,
    damping: 26,
    mass: 0.5,
};

/**
 * A letter arriving in the pool for the first time.
 *
 * Deliberately *not* a flight from the word bubble. The bubble lives inside the
 * scrolling message list, and framer's layout projection across a scroll
 * container reports stale positions — the tile would launch from the wrong
 * place, which is worse than not flying at all. It springs into being in the
 * pool instead, and the bubble pulses at the same moment, which reads as the
 * same event without the risk.
 */
export const SPAWN_SPRING: Transition = {
    type: 'spring',
    stiffness: 520,
    damping: 30,
    mass: 0.7,
};

/**
 * Above this many tiles the idle drift is switched off.
 *
 * Motion is a signal — "these letters have no place yet" — and a signal that
 * every tile on screen is emitting at once is just noise, on top of being the
 * densest case for the compositor. A long phrase keeps the static tilt.
 */
export const MAX_DRIFTING_TILES = 12;

/**
 * How far a tile may sit off the band's centre line, in px.
 *
 * The pool is one row and stays one row — a scatter that grows the composer
 * when a letter arrives would move the board under the player's thumb, which is
 * the thing this module exists to prevent. So the scatter happens *inside* a
 * fixed band: the tiles lose their shared baseline without the band losing its
 * height. `.pool-track`'s `padding-block` is sized to cover this plus the bob
 * and the glow, or `overflow-x: auto` crops the lifted tiles.
 */
export const MAX_LIFT_PX = 3;

/** The seeded range of the gap in front of a tile, in px. */
const GAP_MIN_PX = 5;
const GAP_RANGE_PX = 9;

/**
 * Per-tile scatter: tilt, lift, the gap in front of it, and the drift's phase.
 *
 * Keyed off the tile's own id rather than its position in the row, so a tile
 * that outlives a rebuild keeps its angle and phase instead of twitching —
 * the same mistake `cipherVariants.tiltSeed` was written to fix.
 *
 * Why these three properties and not a label: the pool holds letters that have
 * no order, and the way to say so is to stop drawing them as a sequence.
 * An even rhythm on a shared baseline reads as a row whatever it is called, so
 * the baseline and the rhythm both go — irregular gaps, each tile lifted a
 * little differently, each at its own angle. Form states the rule; no chrome
 * has to assert it, and nothing has to be translated into seven languages.
 *
 * `seedFromId` is the pool's own seed, shared with the scramble so a tile's
 * look and its place come from one number. It also avalanches, which matters
 * here for the same reason it matters there: tile ids differ only in their last
 * character, and the old `hash * 31 + code` turned that into a sawtooth — tilts
 * that alternated sign and cycled through four values in lockstep down the row.
 */
export function driftStyle(id: string, drifting: boolean): CSSProperties {
    const seed = seedFromId(id);

    const tilt = (seed % 2 === 0 ? 1 : -1) * (2 + ((seed >>> 3) % 5));
    const lift = (((seed >>> 7) % (MAX_LIFT_PX * 2 + 1)) - MAX_LIFT_PX);
    const gap = GAP_MIN_PX + ((seed >>> 13) % GAP_RANGE_PX);
    const phase = ((seed >>> 19) % 13) * 0.34;

    return {
        '--pool-tilt': `${tilt}deg`,
        '--pool-lift': `${lift}px`,
        '--pool-gap': `${gap}px`,
        '--pool-phase': `-${phase.toFixed(2)}s`,
        animationPlayState: drifting ? 'running' : 'paused',
    } as CSSProperties;
}
