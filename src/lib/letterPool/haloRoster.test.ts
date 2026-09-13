import { describe, expect, it } from 'vitest';
import { layoutHalo } from './haloLayout';
import { mergeRoster, occupiedIds } from './haloRoster';
import type { PoolLetter } from './poolRules';

const letter = (index: number, char: string): PoolLetter => ({
    id: `pool-${index}`,
    char,
    slotIndex: null,
});

/** Seven loose letters, as a level-2 mask on an eleven-letter answer leaves. */
const pool = [
    letter(1, 'l'), letter(2, 'o'), letter(4, 'h'), letter(5, 'e'),
    letter(6, 's'), letter(8, 'i'), letter(10, 'e'),
];

describe('mergeRoster', () => {
    it('keeps a letter that has left the pool', () => {
        const afterPlacing = pool.filter((l) => l.id !== 'pool-4');

        expect(mergeRoster(pool, afterPlacing).map((l) => l.id))
            .toEqual(pool.map((l) => l.id));
    });

    it('adds letters a fresh hint has revealed, at the end', () => {
        const grown = [...pool, letter(3, 't')];

        expect(mergeRoster(pool, grown).map((l) => l.id))
            .toEqual([...pool.map((l) => l.id), 'pool-3']);
    });

    // The layout below memoises on this reference, so an unchanged pool must
    // not re-solve the halo on every keystroke.
    it('hands back the same list when nothing is new', () => {
        expect(mergeRoster(pool, pool)).toBe(pool);
        expect(mergeRoster(pool, pool.slice(0, 3))).toBe(pool);
    });

    it('starts from the pool when there is no history', () => {
        expect(mergeRoster([], pool)).toEqual(pool);
    });
});

describe('the halo holds still while letters leave', () => {
    /**
     * The bug this exists for.
     *
     * Solved against the live pool, removing one letter closed the list up and
     * moved every letter behind it to a different band — so placing one letter
     * sent the rest flying to each other's spots.
     */
    it('leaves every remaining letter exactly where it was', () => {
        const before = layoutHalo(pool);
        const afterPlacing = pool.filter((l) => l.id !== 'pool-4');
        const after = layoutHalo(mergeRoster(pool, afterPlacing));

        for (const spot of before) {
            expect(after.find((other) => other.id === spot.id)).toEqual(spot);
        }
    });

    it('still moves them all when the roster is not used', () => {
        // Guards the claim above: without the roster this is the behaviour, so
        // a future change that quietly drops it fails here rather than in QA.
        const before = layoutHalo(pool);
        const after = layoutHalo(pool.filter((l) => l.id !== 'pool-4'));
        const moved = after.filter((spot) => {
            const was = before.find((other) => other.id === spot.id);
            return was && (was.inlineStart !== spot.inlineStart || was.blockStart !== spot.blockStart);
        });

        expect(moved.length).toBeGreaterThan(0);
    });

    /**
     * The limit of the fix, stated rather than discovered.
     *
     * A letter *arriving* still re-divides the edge it lands on, because the
     * bands are shares of an edge and there is now one more of them. That is
     * not the reported bug and not worth the cost of fixing: the pool only
     * grows when a hint uncovers more letters — at most once or twice a word,
     * and never after the anagram is drawn, since the mask is not regenerated
     * again — and it is a moment the player is already watching change. The
     * bug was the halo re-solving on *every* placement, which this prevents.
     */
    it('keeps every letter, though a new arrival re-divides its edge', () => {
        const before = layoutHalo(pool);
        const after = layoutHalo(mergeRoster(pool, [...pool, letter(3, 't')]));

        expect(after.map((spot) => spot.id)).toEqual([...before.map((s) => s.id), 'pool-3']);
        for (const spot of before) {
            expect(after.find((other) => other.id === spot.id)?.char).toBe(spot.char);
        }
    });

    it('draws only the letters still in the pool', () => {
        const afterPlacing = pool.filter((l) => l.id !== 'pool-4');
        const roster = mergeRoster(pool, afterPlacing);
        const live = occupiedIds(afterPlacing);
        const drawn = layoutHalo(roster).filter((spot) => live.has(spot.id));

        expect(drawn).toHaveLength(6);
        expect(drawn.some((spot) => spot.id === 'pool-4')).toBe(false);
    });
});

describe('occupiedIds', () => {
    it('reports what is in the pool right now', () => {
        expect(occupiedIds(pool)).toEqual(new Set(pool.map((l) => l.id)));
        expect(occupiedIds([])).toEqual(new Set());
    });
});
