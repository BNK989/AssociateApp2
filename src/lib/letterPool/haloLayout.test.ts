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
            expect(spot.x.percent).toBeGreaterThanOrEqual(35);
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

    // Seeded sampling alone clumps often enough to look like a defect, which is
    // what the farthest-point pass is for.
    it('does not put two letters at the same spot', () => {
        const places = layoutHalo(pool('abcdefghijk'))
            .map((placement) => `${placement.inlineStart}|${placement.blockStart}`);
        expect(new Set(places).size).toBe(places.length);
    });

    it('is empty for an empty pool', () => {
        expect(layoutHalo([])).toEqual([]);
    });
});
