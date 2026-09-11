import { seedFromId, type PoolLetter } from './poolRules';

/**
 * Where a found letter sits around the word it belongs to.
 *
 * The pool used to be a docked strip above the composer, and no amount of
 * jitter rescued it: a horizontal band whose only content is letters is read
 * left to right, because that is what a band is for. The letters therefore
 * leave the band the same way they once left the word line — by leaving the
 * container that was making the claim.
 *
 * They now hang around the target bubble itself. Three things follow from that
 * and none of them is decoration:
 *
 * - **There is no reading direction.** An arc has no first item. The eye jumps
 *   between letters instead of scanning them, which is the honest depiction of
 *   a set with no order.
 * - **They belong to a word, visibly.** The strip never said *which* word its
 *   letters came from; the player had to hold that themselves.
 * - **They scroll with it.** The halo is a child of the bubble, so it needs no
 *   measurement, no `ResizeObserver` and no scroll listener, and it cannot
 *   drift out of sync with the thing it annotates. Scroll the word away and its
 *   letters go with it, which is correct: they are that word's letters.
 *
 * Everything here is expressed as CSS offsets from the bubble's own box — `calc`
 * of a percentage and a pixel pad — so the layout is resolved by the browser
 * against the live element. A bubble that grows a hint panel spreads its halo
 * wider for free.
 */

/**
 * The free region, in the bubble's own coordinates.
 *
 * Two attempts failed here and both are worth keeping, because each one looked
 * right in the abstract:
 *
 * 1. **An arc.** Parameterised by angle, most of the range lands on whichever
 *    edge is longest, and a chat bubble is tall. Seven letters came out as a
 *    near-vertical column down the trailing side — a list, read top to bottom,
 *    the same defect as the row it replaced wearing a different coat.
 * 2. **A wide column beside the bubble.** The scatter was right, but the column
 *    is not there. A bubble is `max-w-[70%]`, which suggests about a third of
 *    the row is free — but a bubble carrying a hint panel runs close to that
 *    maximum, and what is actually left is nearer 40px than 85. Letters sampled
 *    50px out ran off the edge of the screen.
 *
 * So the letters **hug the bubble's perimeter**, straddling it: a little
 * outside, a little over its padding. That is the only region whose size does
 * not depend on how wide the bubble happens to be, which makes it the only one
 * that cannot overflow. It also reads better than the column did — the letters
 * cling to the word they belong to rather than floating in a margin near it.
 *
 * Three edges, never the leading one: the avatar is there, and so is every
 * neighbouring bubble, which is `max-w-[70%]` on the same side.
 */

/** Which edge a letter hugs: below `TRAILING_SHARE` the trailing one, below `BOTTOM_SHARE` the bottom, else the top. */
const TRAILING_SHARE = 5;
const BOTTOM_SHARE = 8;

/**
 * The order the edges are handed out in.
 *
 * A plain `index % 10` weights the edges correctly and still fails the case
 * that prompted all of this: with three letters it put two of them on the
 * trailing edge, which is a vertical line — the column again, at exactly the
 * pool size a player sees most often. This sequence visits all three edges in
 * its first three draws and still lands on the same 5 / 3 / 2 split over ten.
 */
const EDGE_ORDER = [0, 6, 8, 2, 5, 9, 4, 7, 1, 3];

/** Straddling the trailing edge: from just inside it to just outside. */
const TRAILING_IN = -10;
const TRAILING_OUT = 26;

/** Straddling the bottom edge, within the 16px gap to the next message. */
const BOTTOM_IN = -8;
const BOTTOM_OUT = 16;
/** …and where across it, from the bubble's middle to its trailing corner. */
const BOTTOM_START = 35;
const BOTTOM_SPAN = 65;

/** Straddling the top edge, trailing half only — the leading half is the previous message. */
const TOP_IN = 6;
const TOP_OUT = -14;
const TOP_START = 55;
const TOP_SPAN = 45;

/**
 * How many placements each letter tries before taking the best.
 *
 * Seeded sampling alone clumps: two letters land on top of each other often
 * enough to look like a defect. Each letter therefore proposes this many spots
 * and keeps whichever is furthest from the letters already placed — farthest
 * point sampling, which spreads a set without solving for the whole arrangement
 * at once, and stays deterministic because the candidates are seeded.
 */
const CANDIDATES = 8;

/** A nominal bubble, used only to compare candidate spacings. */
const NOMINAL_W = 200;
const NOMINAL_H = 80;

export interface HaloPlacement {
    id: string;
    char: string;
    /** CSS length for `inset-inline-start`, so the halo mirrors in Hebrew. */
    inlineStart: string;
    /** CSS length for `inset-block-start`. */
    blockStart: string;
    /** Resting angle, degrees. */
    tilt: number;
    /** Multiplier on the base glyph size. */
    scale: number;
    /** Negative animation delay, seconds, so tiles do not bob in unison. */
    phase: number;
}

/**
 * Place every loose letter around the bubble.
 *
 * `mirror` flips the region to the leading side, for the rare target that is
 * the player's own message and therefore sits on the other side of the row.
 */
export function layoutHalo(letters: PoolLetter[], mirror = false): HaloPlacement[] {
    const taken: Array<{ x: number; y: number }> = [];

    return letters.map((letter, index) => {
        const seed = seedFromId(letter.id);
        const edge = EDGE_ORDER[index % EDGE_ORDER.length];

        let best = propose(seed, 0, edge);
        let bestGap = spacing(best, taken);

        for (let attempt = 1; attempt < CANDIDATES; attempt++) {
            const spot = propose(seed, attempt, edge);
            const gap = spacing(spot, taken);
            if (gap > bestGap) {
                best = spot;
                bestGap = gap;
            }
        }

        taken.push({ x: best.xPct / 100 * NOMINAL_W + best.xPx, y: best.yPct / 100 * NOMINAL_H + best.yPx });

        return {
            id: letter.id,
            char: letter.char,
            inlineStart: offset(mirror ? 100 - best.xPct : best.xPct, mirror ? -best.xPx : best.xPx),
            blockStart: offset(best.yPct, best.yPx),
            tilt: (seed % 2 === 0 ? 1 : -1) * (4 + ((seed >>> 3) % 15)),
            scale: 0.92 + ((seed >>> 11) % 5) * 0.07,
            phase: ((seed >>> 19) % 13) * 0.34,
        };
    });
}

interface Spot {
    xPct: number;
    xPx: number;
    yPct: number;
    yPx: number;
}

/** One candidate spot for a letter, in the bubble's own coordinates. */
function propose(seed: number, attempt: number, edge: number): Spot {
    const a = unit(seed, attempt * 3);
    const b = unit(seed, attempt * 3 + 1);
    const c = unit(seed, attempt * 3 + 2);

    if (edge < TRAILING_SHARE) {
        return {
            xPct: 100,
            xPx: TRAILING_IN + a * (TRAILING_OUT - TRAILING_IN),
            // Past the corners at both ends, so the trailing edge's letters do
            // not stop dead where the bubble does.
            yPct: -8 + b * 116,
            yPx: 0,
        };
    }

    if (edge < BOTTOM_SHARE) {
        return {
            xPct: BOTTOM_START + a * BOTTOM_SPAN,
            xPx: b * 18,
            yPct: 100,
            yPx: BOTTOM_IN + c * (BOTTOM_OUT - BOTTOM_IN),
        };
    }

    return {
        xPct: TOP_START + a * TOP_SPAN,
        xPx: b * 18,
        yPct: 0,
        yPx: TOP_IN + c * (TOP_OUT - TOP_IN),
    };
}

/** How far a candidate sits from the nearest letter already placed. */
function spacing(spot: Spot, taken: Array<{ x: number; y: number }>): number {
    if (taken.length === 0) return Infinity;

    const x = spot.xPct / 100 * NOMINAL_W + spot.xPx;
    const y = spot.yPct / 100 * NOMINAL_H + spot.yPx;

    return Math.min(...taken.map((other) => Math.hypot(x - other.x, y - other.y)));
}

/**
 * A seeded value in [0, 1).
 *
 * The stream has to be independent per draw, or a letter's x and y move
 * together and every candidate lands on one diagonal. Mixing the index in
 * before the avalanche is what separates them.
 */
function unit(seed: number, index: number): number {
    let hash = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b) >>> 0;
    hash ^= hash >>> 13;
    return ((hash >>> 8) % 100_000) / 100_000;
}

/** One axis: a share of the box, plus a pixel pad. */
function offset(percent: number, pixels: number): string {
    return `calc(${percent.toFixed(1)}% + ${pixels.toFixed(1)}px)`;
}
