import { seedFromId, type PoolLetter } from './poolRules';

/**
 * Where a found letter hangs around the word it belongs to.
 *
 * The pool used to be a docked strip above the composer, and no amount of
 * jitter rescued it: a horizontal band whose only content is letters is read
 * left to right, because that is what a band is for. The letters therefore
 * leave the band the same way they once left the word line — by leaving the
 * container that was making the claim.
 *
 * They now hang around the target bubble itself. Three things follow, and none
 * of them is decoration:
 *
 * - **There is no reading direction.** A scatter has no first item. The eye
 *   jumps between letters instead of scanning them, which is the honest
 *   depiction of a set with no order.
 * - **They belong to a word, visibly.** The strip never said *which* word its
 *   letters came from; the player held that themselves.
 * - **They scroll with it.** The halo is a child of the bubble, so it needs no
 *   measurement, no `ResizeObserver` and no scroll listener, and cannot drift
 *   out of sync with the thing it annotates.
 *
 * Everything here is a CSS offset from the bubble's own box — `calc` of a
 * percentage and a pixel pad — so the browser resolves it against the live
 * element. A bubble that grows a hint panel spreads its halo for free.
 */

/**
 * The three usable edges, and the order they are handed out in.
 *
 * Each edge owns its own stretch and stops short of the corners, because the
 * bands below only guarantee spacing *within* an edge. Left overlapping, a
 * bottom-edge chip and a trailing-edge chip met at the corner and sat on top of
 * each other — which no amount of per-edge spacing could have caught.
 *
 * Never the leading one: the avatar is there, and so is every neighbouring
 * bubble, which is `max-w-[70%]` on the same side.
 *
 * The cycle visits all three in its first three draws. A plain weighted modulo
 * gets the proportions right and still fails the commonest case — with three
 * letters it put two on the trailing edge, which is a vertical line, the column
 * this layout exists to avoid.
 *
 * Over ten letters it lands on 5 bottom, 3 trailing, 2 top, which is what the
 * edges can actually hold. The split is not a taste call: the bottom edge is
 * the full width of the bubble (~180px of usable run), the trailing edge only
 * its height (~127px), and the top edge just the trailing half of its width. An
 * even-handed split put five chips on the trailing edge, which needs 120px of
 * the 127 available and leaves no room to jitter — so they touched.
 */
type Edge = 'trailing' | 'bottom' | 'top';

const EDGE_CYCLE: Edge[] = [
    'bottom', 'trailing', 'top',
    'bottom', 'trailing', 'bottom',
    'top', 'bottom', 'trailing', 'bottom',
];

/**
 * Straddling the trailing edge: how far inside and outside it a chip's centre
 * may sit, and how far past the corners it may run.
 *
 * These are centre points and a letter is a ~30px chip drawn around one, so
 * they are tighter than they look: a centre 18px out puts the chip's far side
 * at 33px, and the free column beside a wide bubble is about 40px. Reaching
 * further in is what starts covering the word being solved.
 */
const TRAILING_IN = -8;
const TRAILING_OUT = 18;
const TRAILING_TOP = 2;
const TRAILING_SPAN = 86;

/**
 * Straddling the bottom edge, within the 16px gap to the next message.
 *
 * The run starts a third of the way across — further toward the leading side
 * and a chip sits over the top corner of the message below — and ends past the
 * trailing corner, where the free column continues and there is nothing to
 * collide with.
 */
const BOTTOM_IN = -6;
const BOTTOM_OUT = 14;
const BOTTOM_START = 32;
const BOTTOM_SPAN = 80;

/**
 * Straddling the top edge, trailing half only.
 *
 * The tightest of the three, because it reaches into the 16px row gap: a centre
 * 14px above the edge already puts a chip's top at 29px, kissing the previous
 * bubble's lower trailing corner. That corner is empty in practice — a bubble
 * is `max-w-[70%]` and leading-aligned — but it is the first thing to check on
 * a real board.
 */
const TOP_IN = 2;
const TOP_OUT = -14;
const TOP_START = 48;
const TOP_SPAN = 44;

/**
 * How far a letter may wander inside its own band, as a share of the band.
 *
 * Not 1: at a full band's width two neighbours can meet at the boundary, which
 * is the overlap the bands exist to prevent.
 */
const BAND_JITTER = 0.4;

/** Pool sizes between which the chips shrink to keep fitting. */
const ROOMY_UP_TO = 5;
const CROWDED_FROM = 12;
const CROWDED_SCALE = 0.78;

export interface HaloPlacement {
    id: string;
    char: string;
    /** CSS length for `inset-inline-start`, so the halo mirrors in Hebrew. */
    inlineStart: string;
    /** CSS length for `inset-block-start`. */
    blockStart: string;
    /** Resting angle, degrees. */
    tilt: number;
    /** Multiplier on the base chip size. */
    scale: number;
    /** Negative animation delay, seconds, so chips do not bob in unison. */
    phase: number;
}

/**
 * Place every loose letter around the bubble.
 *
 * Each edge is divided into one band per letter that landed on it, and the
 * letter is jittered inside its band. That is what guarantees the chips do not
 * collide — the first version sampled the region freely and took the best of
 * fourteen tries, which was enough for bare glyphs and not nearly enough once
 * each letter became a 30px keycap: seven of them piled up along one edge.
 *
 * `mirror` flips the region to the leading side, for the rare target that is
 * the player's own message and sits on the other side of the row.
 */
export function layoutHalo(letters: PoolLetter[], mirror = false): HaloPlacement[] {
    const chip = chipScale(letters.length);
    const edges = letters.map((_, index) => EDGE_CYCLE[index % EDGE_CYCLE.length]);

    // Which band each letter takes on its edge. Ordered by seed rather than by
    // position in the pool, so even the sequence along one edge carries nothing.
    const bands = new Map<string, number>();
    for (const edge of ['trailing', 'bottom', 'top'] as Edge[]) {
        letters
            .filter((_, index) => edges[index] === edge)
            .sort((a, b) => seedFromId(a.id) - seedFromId(b.id))
            .forEach((letter, band) => bands.set(letter.id, band));
    }

    const perEdge = (edge: Edge) => edges.filter((other) => other === edge).length;

    return letters.map((letter, index) => {
        const seed = seedFromId(letter.id);
        const edge = edges[index];
        const band = bands.get(letter.id) ?? 0;

        // The band's centre, nudged within it.
        const along = (band + 0.5 + (unit(seed, 0) - 0.5) * BAND_JITTER) / perEdge(edge);
        const across = unit(seed, 1);

        const spot = place(edge, along, across);

        return {
            id: letter.id,
            char: letter.char,
            inlineStart: offset(mirror ? 100 - spot.xPct : spot.xPct, mirror ? -spot.xPx : spot.xPx),
            blockStart: offset(spot.yPct, spot.yPx),
            tilt: (seed % 2 === 0 ? 1 : -1) * (4 + ((seed >>> 3) % 15)),
            scale: chip * (0.95 + ((seed >>> 11) % 4) * 0.04),
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

/** One letter's spot: `along` runs down or across its edge, `across` straddles it. */
function place(edge: Edge, along: number, across: number): Spot {
    if (edge === 'trailing') {
        return {
            xPct: 100,
            xPx: TRAILING_IN + across * (TRAILING_OUT - TRAILING_IN),
            yPct: TRAILING_TOP + along * TRAILING_SPAN,
            yPx: 0,
        };
    }

    if (edge === 'bottom') {
        return {
            xPct: BOTTOM_START + along * BOTTOM_SPAN,
            xPx: 0,
            yPct: 100,
            yPx: BOTTOM_IN + across * (BOTTOM_OUT - BOTTOM_IN),
        };
    }

    return {
        xPct: TOP_START + along * TOP_SPAN,
        xPx: 0,
        yPct: 0,
        yPx: TOP_IN + across * (TOP_OUT - TOP_IN),
    };
}

/**
 * How big the chips are, given how many there are.
 *
 * A bubble's perimeter is fixed and a chip is not free, so past a handful the
 * only way to keep them from touching is to make them smaller — the way a rack
 * of tiles reads tighter as it fills. Full size up to five letters, which
 * covers most words; down to 78% by twelve, which is where the longest daily
 * phrases land.
 */
function chipScale(count: number): number {
    if (count <= ROOMY_UP_TO) return 1;
    if (count >= CROWDED_FROM) return CROWDED_SCALE;

    const through = (count - ROOMY_UP_TO) / (CROWDED_FROM - ROOMY_UP_TO);
    return 1 - through * (1 - CROWDED_SCALE);
}

/**
 * A seeded value in [0, 1).
 *
 * The stream has to be independent per draw, or a letter's position along its
 * edge and its offset across it move together and every chip lands on one
 * diagonal. Mixing the index in before the avalanche is what separates them.
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
