/**
 * The path a found letter takes from the halo into its slot.
 *
 * Why this is hand-rolled rather than a framer `layoutId` handoff: the halo
 * hangs inside the scrolling message list and the strip sits in the composer,
 * and framer's shared-layout projection across a scroll container reports stale
 * positions — the letter launches from the wrong place. Measuring both ends
 * with `getBoundingClientRect` and flying a copy in a fixed overlay sidesteps
 * that completely, because viewport coordinates have no containing block and no
 * scroll parent to be wrong about.
 *
 * Everything here is arithmetic on two rectangles, so it is pure and tested.
 * The component that runs it only reads the DOM and hands framer the result.
 */

/** A measured element, in viewport coordinates. */
export interface Rect {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface FlightPath {
    /** Where the flying copy is pinned, and how big it starts. */
    left: number;
    top: number;
    width: number;
    height: number;
    /** Position keyframes, as offsets from the origin. Eased already; play linear. */
    x: number[];
    y: number[];
    /** Size keyframes: a lift, then settling to the slot's size. */
    scale: number[];
    scaleTimes: number[];
    /** The chip's resting angle unwinding to flat. */
    rotate: number[];
    rotateTimes: number[];
    /** The keycap's face and shadow dissolving as it becomes strip text. */
    skin: number[];
    skinTimes: number[];
    /** How long the outline left behind at the origin lingers, in ms. */
    ghostMs: number;
    durationMs: number;
}

/** Samples along the arc. Enough that linear interpolation between them reads as a curve. */
const SAMPLES = 14;

/**
 * How far the arc bows off the straight line, as a share of the distance.
 *
 * A straight line reads mechanical — the letter is being dragged. A slight lob
 * reads as being *drawn*, which is the verb this animation is for.
 */
const BOW = 0.2;
const BOW_CEILING = 68;

/**
 * How the two ends size their type, which is what the flight has to match.
 *
 * A chip is `1.85em` tall (`.halo-letter`), so its height gives its type size.
 * A slot's glyph is `0.62` of the cell's width (`--slot-font` in
 * `letter-pool.css`). Scaling by the *boxes* instead lands the letter at 13px
 * where the cell will draw it at 15px, and it pops bigger the instant it
 * arrives — the one thing a docking animation must not do.
 *
 * These two numbers are duplicated from CSS on purpose: the alternative is a
 * `getComputedStyle` on the typing path, and this is measured by a test.
 */
const CHIP_EM = 1.85;
const SLOT_FONT_RATIO = 0.62;

/** The lift as the letter leaves, and where in the flight it peaks. */
const LIFT = 1.12;
const LIFT_AT = 0.14;

/** How long the outline left at the origin lingers. */
const GHOST_MS = 190;

/** Duration, in ms: a floor, a share of the distance, and a ceiling. */
const BASE_MS = 210;
const MS_PER_PX = 0.34;
const MAX_MS = 430;

/**
 * The timing curve. Fast off the mark, long soft landing — the letter arrives
 * already nearly stopped, which is what makes it read as docking rather than
 * hitting. Shared with the pool's own entrance, so the feature moves as one.
 */
const EASE = [0.32, 0.72, 0, 1] as const;

/**
 * Plan a flight from a halo chip to its slot cell.
 *
 * `tilt` is the chip's resting angle, which unwinds to flat on arrival. That is
 * the one part of this carrying meaning rather than polish: everywhere else in
 * the game a tilt means *this letter has no place* and stillness means settled,
 * so a letter straightening as it lands is that rule stated in motion.
 */
export function planFlight(from: Rect, to: Rect, tilt: number): FlightPath {
    const start = centre(from);
    const end = centre(to);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);

    const control = bow(start.x, start.y, dx, dy, distance);

    const x: number[] = [];
    const y: number[] = [];
    for (let sample = 0; sample < SAMPLES; sample++) {
        // Position is sampled at *eased* times and played back linearly. Handing
        // framer one easing for a keyframe array applies it between every pair,
        // which makes a fourteen-segment path stutter fourteen times.
        const progress = ease(sample / (SAMPLES - 1));
        const point = quadratic(start, control, end, progress);
        x.push(round(point.x - start.x));
        y.push(round(point.y - start.y));
    }

    // Sized so the flying letter is already exactly the size the cell will draw
    // it, and nothing changes at the moment of arrival.
    // The clamp guards a degenerate measurement, not the design: a real pairing
    // always lands well inside it, and capping tighter would reintroduce the
    // size pop it exists to remove.
    const landed = clamp(
        (to.width * SLOT_FONT_RATIO * CHIP_EM) / Math.max(from.height, 1),
        0.3,
        1.6,
    );

    return {
        left: from.left,
        top: from.top,
        width: from.width,
        height: from.height,
        x,
        y,
        scale: [1, LIFT, landed],
        scaleTimes: [0, LIFT_AT, 1],
        rotate: [tilt, round(tilt * 0.35), 0],
        rotateTimes: [0, 0.5, 1],
        // Held while it travels, gone by the time it lands: the letter becomes
        // strip text rather than arriving as a foreign object on top of it.
        skin: [1, 1, 0],
        skinTimes: [0, 0.5, 1],
        durationMs: Math.round(Math.min(BASE_MS + distance * MS_PER_PX, MAX_MS)),
        // A trace of the chip stays where it was and fades. Without it the
        // letter's departure has no cause — something simply appears in
        // mid-air. It is deliberately shorter than the flight, so the eye is
        // released to follow the letter rather than held at the origin.
        ghostMs: GHOST_MS,
    };
}

function centre(rect: Rect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * The arc's control point.
 *
 * Always lobbed — the perpendicular is taken in whichever direction points
 * *up*, so the letter rises before it settles no matter which way it is
 * travelling. Picking a side by the sign of the travel instead makes a flight
 * to the left and a flight to the right curve opposite ways, which looks like
 * two different animations.
 */
function bow(x: number, y: number, dx: number, dy: number, distance: number) {
    if (distance < 1) return { x, y };

    let px = -dy / distance;
    let py = dx / distance;
    if (py > 0) {
        px = -px;
        py = -py;
    }

    const depth = Math.min(distance * BOW, BOW_CEILING);
    return { x: x + dx / 2 + px * depth, y: y + dy / 2 + py * depth };
}

function quadratic(
    start: { x: number; y: number },
    control: { x: number; y: number },
    end: { x: number; y: number },
    t: number,
) {
    const inverse = 1 - t;
    const a = inverse * inverse;
    const b = 2 * inverse * t;
    const c = t * t;
    return {
        x: a * start.x + b * control.x + c * end.x,
        y: a * start.y + b * control.y + c * end.y,
    };
}

/**
 * `cubic-bezier(EASE)` solved for a given time.
 *
 * Newton-Raphson with a bisection fallback, which is what browsers do: the
 * curve is y-over-x and the x we are given is time, so the root has to be found
 * before y can be read.
 */
export function ease(time: number): number {
    const [x1, y1, x2, y2] = EASE;
    if (time <= 0) return 0;
    if (time >= 1) return 1;

    let guess = time;
    for (let step = 0; step < 8; step++) {
        const error = bezierAxis(guess, x1, x2) - time;
        if (Math.abs(error) < 1e-6) return bezierAxis(guess, y1, y2);

        const slope = bezierSlope(guess, x1, x2);
        if (Math.abs(slope) < 1e-6) break;
        guess -= error / slope;
    }

    let low = 0;
    let high = 1;
    guess = time;
    for (let step = 0; step < 24; step++) {
        const at = bezierAxis(guess, x1, x2);
        if (Math.abs(at - time) < 1e-6) break;
        if (at > time) high = guess;
        else low = guess;
        guess = (low + high) / 2;
    }

    return bezierAxis(guess, y1, y2);
}

function bezierAxis(t: number, a: number, b: number): number {
    const inverse = 1 - t;
    return 3 * inverse * inverse * t * a + 3 * inverse * t * t * b + t * t * t;
}

function bezierSlope(t: number, a: number, b: number): number {
    const inverse = 1 - t;
    return 3 * inverse * inverse * a
        + 6 * inverse * t * (b - a)
        + 3 * t * t * (1 - b);
}

function clamp(value: number, low: number, high: number): number {
    return Math.min(Math.max(value, low), high);
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}
