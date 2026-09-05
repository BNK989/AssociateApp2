import type { Variants } from 'framer-motion';

/** Widest tilt a loose tile may take. */
const MAX_TILT_DEG = 6;

/**
 * A tile's tilt, in degrees, from a stable seed.
 *
 * Derived rather than randomised so a tile keeps its angle instead of twitching.
 * The seed must identify the *letter*, not the slot it currently occupies —
 * `ScrambleView` used to pass the array index, so every shuffle reassigned the
 * tilts and produced exactly the twitching this was written to avoid.
 */
function tiltFor(seed: number): number {
    const sign = seed % 2 === 0 ? 1 : -1;
    return sign * (2 + ((seed * 1337) % (MAX_TILT_DEG - 1)));
}

/**
 * A small stable number identifying a tile, used to seed its tilt.
 *
 * Keyed off the tile id, which encodes the letter's *original* index and so
 * survives a shuffle, unlike the array position the renderer sees.
 */
export function tiltSeed(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) % 100_000;
    }
    return hash;
}

/**
 * Idle drift for loose letters, so they read as tiles waiting to be placed
 * rather than settled text. Only applied to tiles whose slot is not the
 * letter's own.
 *
 * The tilt used to reach 24 degrees, which costs real legibility for no added
 * meaning; the drift alone carries the signal. It is worst in Hebrew and
 * Arabic, where the script is already doing more work.
 *
 * `tilt` is the reduced-motion form. It keeps the angle — a static transform is
 * not movement, and dropping it would cost the only per-tile cue that a slot is
 * meaningless — and drops the endless vertical drift, which is the part that
 * troubles vestibular sensitivity.
 */
export const floatVariant: Variants = {
    float: (seed: number) => ({
        y: [0, -4, 0],
        rotate: tiltFor(seed),
        transition: {
            y: { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: (seed % 10) * 0.2 },
            rotate: { duration: 0 },
        },
    }),
    tilt: (seed: number) => ({
        y: 0,
        rotate: tiltFor(seed),
        transition: { duration: 0 },
    }),
};

/** One-shot flash when a letter is newly revealed by a bought hint. */
export const popVariant: Variants = {
    pop: (isMatch: boolean) => ({
        scale: [1, 1.5, 1],
        textShadow: isMatch
            ? ['0px 0px 0px rgba(0,0,0,0)', '0px 0px 8px rgba(251, 191, 36, 0.8)', '0px 0px 0px rgba(0,0,0,0)']
            : 'none',
        transition: { duration: 0.4, ease: 'easeOut' },
    }),
    /** Reduced-motion form: the letter still announces itself, without the jump. */
    popStill: (isMatch: boolean) => ({
        scale: 1,
        textShadow: isMatch
            ? ['0px 0px 0px rgba(0,0,0,0)', '0px 0px 8px rgba(251, 191, 36, 0.8)', '0px 0px 0px rgba(0,0,0,0)']
            : 'none',
        transition: { duration: 0.6, ease: 'easeOut' },
    }),
};

type MotionStateArgs = {
    /** A hint just uncovered this position. */
    flashing: boolean;
    /** The tile's slot is not the letter's own. */
    displaced: boolean;
    /** The viewer asked for reduced motion. */
    reduced: boolean;
};

/**
 * Which variant a tile should animate to, or `undefined` for a settled tile.
 *
 * Pulled out of both views so the reduced-motion fallback cannot be applied in
 * one and forgotten in the other.
 */
export function motionState(
    { flashing, displaced, reduced }: MotionStateArgs,
): 'pop' | 'popStill' | 'float' | 'tilt' | undefined {
    if (flashing) return reduced ? 'popStill' : 'pop';
    if (displaced) return reduced ? 'tilt' : 'float';
    return undefined;
}
