import type { Transition } from 'framer-motion';

/**
 * How the halo and the composer's slot strip move.
 *
 * One module so the two halves of the same gesture cannot drift apart, and so
 * every value below can be read against the rule it serves.
 *
 * The rules, in the order they matter:
 *
 * 1. **Only `transform` and `opacity` animate.** Anything that changes layout —
 *    width, height, margin — is a reflow per frame and will never be smooth on
 *    a mid-range phone. The halo is absolutely positioned inside the bubble for
 *    exactly this reason: a letter arriving or leaving costs no layout at all.
 * 2. **Springs, not durations.** A spring retargets from its current velocity,
 *    so a player typing faster than the animation never queues a backlog and
 *    never sees a tile snap. A duration-and-easing tween cannot do that.
 * 3. **Drift is CSS, not JavaScript.** A framer `repeat: Infinity` keeps a JS
 *    loop alive per tile; the board already pays that for every masked word.
 *    The idle motion is a CSS keyframe instead, which the compositor runs
 *    without waking the main thread.
 * 4. **No shared-layout flight.** The halo hangs in the scrolling message list
 *    and the strip sits in the composer. Framer's projection across a scroll
 *    container reports stale positions, so a `layoutId` pairing would launch
 *    the letter from the wrong place. Placing is told twice instead, once at
 *    each end, in the same moment.
 */

/** The landing: a short, tight overshoot that reads as the letter seating. */
export const SETTLE_SPRING: Transition = {
    type: 'spring',
    stiffness: 620,
    damping: 26,
    mass: 0.5,
};

/**
 * A letter arriving in the halo for the first time.
 *
 * Softer and heavier than it was. The old values sprang a chip from 40% to full
 * size in a blink, which is a cartoon pop — fine for a notification badge,
 * wrong for an object the player is meant to read as substantial. This settles
 * rather than snaps, with just enough overshoot to register as a landing.
 */
export const SPAWN_SPRING: Transition = {
    type: 'spring',
    stiffness: 380,
    damping: 26,
    mass: 0.9,
};

/**
 * The gap between letters of the same arrival, in seconds.
 *
 * Counted within the batch that just arrived, not by position in the halo. Keyed
 * on the latter — which is what this did — a single letter deduced from a guess
 * waited on however many letters happened to already be hanging there: seven in,
 * and it appeared a full quarter-second after the keystroke that earned it, for
 * no reason the player could see.
 *
 * It is also the only thing distinguishing a bought hint from a deduced letter,
 * and deliberately so. A hint delivers a handful and they cascade; a guess
 * delivers one and it arrives at once. The quantity does the work, so there is
 * one arrival to design and tune rather than three, and nothing has to tell the
 * player which button they just pressed.
 */
export const ARRIVAL_STAGGER = 0.055;

/** Where the cascade stops lengthening, so a long phrase does not trickle in. */
export const MAX_STAGGER_STEPS = 8;

/**
 * Above this many letters the idle drift is switched off.
 *
 * Motion is a signal — "these letters have no place yet" — and a signal that
 * every tile on screen is emitting at once is just noise, on top of being the
 * densest case for the compositor. A long phrase keeps its static angles, which
 * is also what a reduced-motion player is left with: an angle is not movement,
 * and it is the per-letter cue that nothing here has a position.
 */
export const MAX_DRIFTING_TILES = 12;
