import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PoolLetter } from '@/lib/letterPool/poolRules';
import { useHaloRoster } from './useHaloRoster';

const letter = (index: number, char: string): PoolLetter => ({
    id: `pool-${index}`,
    char,
    slotIndex: null,
});

const pool = [letter(1, 'l'), letter(2, 'o'), letter(4, 'h')];

const setup = (initial: { pool: PoolLetter[]; targetId?: string }) =>
    renderHook(({ pool: p, targetId }: { pool: PoolLetter[]; targetId?: string }) =>
        useHaloRoster(p, targetId), { initialProps: initial });

describe('useHaloRoster', () => {
    it('remembers a letter that has been placed', () => {
        const { result, rerender } = setup({ pool, targetId: 'word-1' });

        rerender({ pool: pool.slice(0, 2), targetId: 'word-1' });

        expect(result.current.map((l) => l.id)).toEqual(['pool-1', 'pool-2', 'pool-4']);
    });

    // The layout memoises on this reference: a new list every keystroke would
    // re-solve the halo and undo the whole point of the roster.
    it('keeps the same list while nothing arrives', () => {
        const { result, rerender } = setup({ pool, targetId: 'word-1' });
        const first = result.current;

        rerender({ pool, targetId: 'word-1' });
        rerender({ pool: pool.slice(0, 1), targetId: 'word-1' });

        expect(result.current).toBe(first);
    });

    it('takes up a letter a hint has just uncovered', () => {
        const { result, rerender } = setup({ pool, targetId: 'word-1' });

        rerender({ pool: [...pool, letter(6, 's')], targetId: 'word-1' });

        expect(result.current.map((l) => l.id)).toContain('pool-6');
    });

    // Otherwise the next word inherits spots reserved for letters that belong
    // to the last one, and opens with a halo full of holes.
    it('starts over on a new word', () => {
        const { result, rerender } = setup({ pool, targetId: 'word-1' });
        const fresh = [letter(0, 'b'), letter(3, 'e')];

        rerender({ pool: fresh, targetId: 'word-2' });

        expect(result.current.map((l) => l.id)).toEqual(['pool-0', 'pool-3']);
    });

    it('reports the new word in the same render it changes', () => {
        // The flight measures where a letter starts from against this, so a
        // roster that is one render stale launches it from the wrong place.
        const { result, rerender } = setup({ pool, targetId: 'word-1' });

        rerender({ pool: [letter(0, 'b')], targetId: 'word-2' });

        expect(result.current).toEqual([letter(0, 'b')]);
    });
});
