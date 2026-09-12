import { describe, expect, it } from 'vitest';
import { layoutHalo } from './haloLayout';
import type { PoolLetter } from './poolRules';

const pool = (chars: string, prefix = 'pool-msg1'): PoolLetter[] =>
    [...chars].map((char, index) => ({ id: `${prefix}-${index}`, char, slotIndex: null }));

/** `calc(X% + Ypx)` back into its two numbers. */
const parse = (value: string) => {
    const match = value.match(/calc\((-?[\d.]+)% \+ (-?[\d.]+)px\)/);
    if (!match) throw new Error(`unparseable offset: ${value}`);
    return { percent: Number(match[1]), pixels: Number(match[2]) };
};

/** A nominal bubble, for measuring how far apart two letters land. */
const NOMINAL_W = 235;
const NOMINAL_H = 110;
/** A chip is 1.85em of a 1.05rem base, scaled by its placement. */
const chipPx = (scale: number) => 1.85 * 1.05 * 16 * scale;

const spots = (count: number, mirror = false) =>
    layoutHalo(pool('abcdefghijk'.slice(0, count)), mirror)
        .map((placement) => ({
            x: parse(placement.inlineStart),
            y: parse(placement.blockStart),
        }));

describe('layoutHalo', () => {
    it('hugs one of the bubble\'s three usable edges, never floats between them', () => {
        for (const spot of spots(11)) {
            const onTrailing = spot.x.percent === 100;
            const onBottom = spot.y.percent === 100;
            const onTop = spot.y.percent === 0;
            expect(onTrailing || onBottom || onTop).toBe(true);
        }
    });

    // The free column beside a wide bubble is nearer 40px than 85 — a bubble
    // carrying a hint panel runs close to its max-width. Letters sampled 50px
    // out ran off the edge of the screen, which is how this was found.
    it('never sends a letter further than 30px from the bubble', () => {
        for (const count of [1, 3, 7, 11]) {
            for (const spot of spots(count)) {
                expect(Math.abs(spot.x.pixels)).toBeLessThanOrEqual(30);
                expect(Math.abs(spot.y.pixels)).toBeLessThanOrEqual(30);
            }
        }
    });

    it('stays off the leading side, where the avatar and every neighbour are', () => {
        for (const spot of spots(11)) {
            expect(spot.x.percent).toBeGreaterThanOrEqual(32);
        }
    });

    it('barely crosses the top edge, where the previous message is', () => {
        for (const spot of spots(11)) {
            if (spot.y.percent !== 0) continue;
            expect(spot.y.pixels).toBeGreaterThanOrEqual(-14);
        }
    });

    // The defect the whole layout exists to kill, at the pool size a player
    // meets most often: three letters down one edge is a vertical line, and a
    // vertical line is a list.
    it('does not stack three letters down one edge', () => {
        const edges = spots(3).map((spot) => `${spot.x.percent}|${spot.y.percent}`);
        expect(new Set(edges).size).toBe(3);
    });

    it('mirrors onto the other side for the player\'s own message', () => {
        const normal = spots(7);
        const mirrored = spots(7, true);
        normal.forEach((spot, index) => {
            expect(mirrored[index].x.percent).toBeCloseTo(100 - spot.x.percent, 4);
            expect(mirrored[index].x.pixels).toBeCloseTo(-spot.x.pixels, 4);
            // Only the inline axis flips; up is still up.
            expect(mirrored[index].y).toEqual(spot.y);
        });
    });

    it('gives the same letters the same places on every rebuild', () => {
        expect(layoutHalo(pool('abcde'))).toEqual(layoutHalo(pool('abcde')));
    });

    it('gives two different words different places', () => {
        expect(layoutHalo(pool('abcde', 'pool-msg1')))
            .not.toEqual(layoutHalo(pool('abcde', 'pool-msg2')));
    });

    it('does not put two letters at the same spot', () => {
        const places = layoutHalo(pool('abcdefghijk'))
            .map((placement) => `${placement.inlineStart}|${placement.blockStart}`);
        expect(new Set(places).size).toBe(places.length);
    });

    // The defect that arrived with the chips: free sampling kept bare glyphs
    // apart and came nowhere near keeping 30px keycaps apart, which piled up
    // along an edge. Measured pairwise across the whole halo rather than per
    // edge, because the first fix spaced each edge correctly and still let a
    // bottom chip and a trailing chip collide where the two met at a corner.
    it('leaves room between every pair of letters, at every pool size', () => {
        for (const count of [2, 5, 7, 9, 11, 13]) {
            const placements = layoutHalo(pool('abcdefghijklm'.slice(0, count)));
            const chip = chipPx(Math.max(...placements.map((p) => p.scale)));

            const points = placements.map((placement) => ({
                x: parse(placement.inlineStart).percent / 100 * NOMINAL_W
                    + parse(placement.inlineStart).pixels,
                y: parse(placement.blockStart).percent / 100 * NOMINAL_H
                    + parse(placement.blockStart).pixels,
            }));

            for (let i = 0; i < points.length; i++) {
                for (let j = i + 1; j < points.length; j++) {
                    const apart = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
                    expect(apart).toBeGreaterThan(chip * 0.8);
                }
            }
        }
    });

    // More letters, smaller chips — the perimeter does not grow with the word.
    it('shrinks the chips as the pool fills', () => {
        const size = (count: number) =>
            Math.max(...layoutHalo(pool('abcdefghijklm'.slice(0, count))).map((p) => p.scale));
        expect(size(3)).toBeGreaterThan(size(8));
        expect(size(8)).toBeGreaterThan(size(13));
    });

    it('is empty for an empty pool', () => {
        expect(layoutHalo([])).toEqual([]);
    });
});

describe('layoutHalo — where a letter comes from', () => {
    const bySide = (count = 11) => {
        const out = { trailing: [] as number[][], bottom: [] as number[][], top: [] as number[][] };
        for (const placement of layoutHalo(pool('abcdefghijk'.slice(0, count)))) {
            const x = parse(placement.inlineStart);
            const y = parse(placement.blockStart);
            const entry = [placement.enterX, placement.enterY];
            if (x.percent === 100) out.trailing.push(entry);
            else if (y.percent === 100) out.bottom.push(entry);
            else out.top.push(entry);
        }
        return out;
    };

    // A letter that materialises where it lives has no cause. Travelling out of
    // the bubble says the word gave it up, which is the only thing that ever
    // makes one appear.
    it('enters from inside the bubble, whichever edge it hangs on', () => {
        const sides = bySide();
        for (const [x, y] of sides.trailing) {
            expect(x).toBeLessThan(0);
            expect(y).toBe(0);
        }
        for (const [x, y] of sides.bottom) {
            expect(y).toBeLessThan(0);
            expect(x).toBe(0);
        }
        for (const [x, y] of sides.top) {
            expect(y).toBeGreaterThan(0);
            expect(x).toBe(0);
        }
    });

    it('comes from far enough to read, and not so far it flies in', () => {
        for (const placement of layoutHalo(pool('abcdefghijk'))) {
            const reach = Math.hypot(placement.enterX, placement.enterY);
            expect(reach).toBeGreaterThanOrEqual(24);
            expect(reach).toBeLessThanOrEqual(35);
        }
    });

    it('mirrors the approach along with the halo', () => {
        const normal = layoutHalo(pool('abcdefg'));
        const mirrored = layoutHalo(pool('abcdefg'), true);
        normal.forEach((placement, index) => {
            expect(mirrored[index].enterX).toBeCloseTo(-placement.enterX, 4);
            expect(mirrored[index].enterY).toBe(placement.enterY);
        });
    });

    // Arriving settles *to* a tilt; being placed unwinds all the way to flat.
    // The two animations state the same rule pointing opposite ways, so the
    // twist has to swing through the resting angle rather than ease down to it.
    it('swings in against the resting tilt rather than with it', () => {
        for (const placement of layoutHalo(pool('abcdefghijk'))) {
            expect(Math.sign(placement.enterTwist)).not.toBe(Math.sign(placement.tilt));
            expect(Math.abs(placement.enterTwist)).toBeGreaterThanOrEqual(9);
            expect(Math.abs(placement.enterTwist)).toBeLessThanOrEqual(16);
        }
    });
});
