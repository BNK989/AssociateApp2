import { describe, expect, it } from 'vitest';
import {
    assembleAttempt,
    buildSlots,
    groupSlots,
    longestGroupLength,
    resolvePlacements,
    typeableCapacity,
    typeableIndices,
} from './slotRules';
import { placedIndices, type PoolLetter } from './poolRules';

/**
 * The composer's strip: what each cell shows, how a typed string maps onto the
 * cells, and how the pool binds to them.
 *
 * These cases lived in `poolRules.test.ts` until 2026-09-13, which had grown
 * past the 350-line cap carrying both halves of the gesture. They are the
 * strip's half and they test `slotRules`, so they belong next to it.
 *
 * Nothing here mocks `SCRAMBLE_MASK`: none of these cases pass a mask, so the
 * strip is read purely from guesses and typing, which is the same under either
 * setting. Mask-fed slots are covered in `positionalReveal.test.ts` and
 * `maskWithholdsPosition.test.ts`.
 */

const slots = (text: string, guesses: string[], typed = '', mode: 'skip' | 'full' = 'skip') =>
    buildSlots({ text, guesses, typed, mode });

describe('typeableCapacity', () => {
    it('counts every slot the player could type into', () => {
        expect(typeableCapacity('Harmony')).toBe(7);
    });

    it('leaves out the scenery the strip supplies', () => {
        expect(typeableCapacity('morning glory')).toBe(12);
        expect(typeableCapacity("o'clock")).toBe(6);
    });
});

describe('typeableIndices', () => {
    it('skips greens and gaps in skip mode', () => {
        expect(typeableIndices('Harmony', placedIndices('Harmony', ['harpoon']), 'skip')).toEqual([3, 5, 6]);
    });

    it('keeps greens in full mode but still skips gaps', () => {
        expect(typeableIndices('a b', placedIndices('a b', []), 'full')).toEqual([0, 2]);
    });
});

describe('buildSlots — skip mode', () => {
    it('fills greens from the answer without the player typing them', () => {
        const result = slots('Harmony', ['harpoon']);
        expect(result[0]).toMatchObject({ kind: 'green', char: 'H' });
        expect(result[4]).toMatchObject({ kind: 'green', char: 'o' });
    });

    it('leaves the rest open and empty', () => {
        const result = slots('Harmony', ['harpoon']);
        expect(result[3]).toMatchObject({ kind: 'open', char: null });
    });

    it('lands the first typed character in the first open slot, not the first slot', () => {
        const result = slots('Harmony', ['harpoon'], 'm');
        expect(result[3]).toMatchObject({ kind: 'open', char: 'm' });
        expect(result[0]).toMatchObject({ kind: 'green', char: 'H' });
    });

    it('fills open slots in order as more is typed', () => {
        const result = slots('Harmony', ['harpoon'], 'mny');
        expect(result[3].char).toBe('m');
        expect(result[5].char).toBe('n');
        expect(result[6].char).toBe('y');
    });

    it('ignores typing beyond the open slots', () => {
        const result = slots('Harmony', ['harpoon'], 'mnyXXX');
        expect(assembleAttempt(result)).toBe('Harmony');
    });

    it('marks a space as a gap and keeps it', () => {
        const result = slots('go on', []);
        expect(result[2]).toMatchObject({ kind: 'gap', char: ' ' });
    });
});

describe('buildSlots — full mode', () => {
    it('shows a green until it is typed over', () => {
        expect(slots('Harmony', ['harpoon'], '', 'full')[0]).toMatchObject({ kind: 'green', char: 'H' });
    });

    it('accepts a matching keystroke over a green without complaint', () => {
        const result = slots('Harmony', ['harpoon'], 'h', 'full');
        expect(result[0]).toMatchObject({ kind: 'green', conflict: false });
    });

    it('marks a disagreement rather than rejecting the keystroke', () => {
        const result = slots('Harmony', ['harpoon'], 'z', 'full');
        expect(result[0]).toMatchObject({ kind: 'green', char: 'z', conflict: true });
    });

    it('maps typing onto every non-gap slot, greens included', () => {
        const result = slots('Harmony', ['harpoon'], 'har', 'full');
        expect(result[2].char).toBe('r');
        expect(result[3].char).toBeNull();
    });
});

describe('assembleAttempt', () => {
    it('returns null while any slot is empty', () => {
        expect(assembleAttempt(slots('Harmony', ['harpoon'], 'mn'))).toBeNull();
    });

    it('returns the whole answer once the strip is full', () => {
        expect(assembleAttempt(slots('Harmony', ['harpoon'], 'mny'))).toBe('Harmony');
    });

    it('puts gap characters back where they belong', () => {
        expect(assembleAttempt(slots('go on', [], 'goon'))).toBe('go on');
    });

    it('returns null for an untouched strip', () => {
        expect(assembleAttempt(slots('Harmony', []))).toBeNull();
    });
});

describe('groupSlots', () => {
    it('keeps a single word as one group', () => {
        expect(groupSlots(slots('Harmony', []))).toHaveLength(1);
    });

    it('splits a phrase at its spaces', () => {
        const groups = groupSlots(slots('morning glory', []));
        expect(groups).toHaveLength(2);
        expect(groups[0].slots).toHaveLength(7);
        expect(groups[1].slots).toHaveLength(5);
    });

    it('carries the space on the group before it rather than as a cell', () => {
        const groups = groupSlots(slots('morning glory', []));
        expect(groups[0].trailing?.char).toBe(' ');
        expect(groups[0].slots.every((slot) => slot.kind !== 'gap')).toBe(true);
    });

    it('keeps a hyphen inside its group, so a hyphenated word does not break apart', () => {
        const groups = groupSlots(slots('well-known', []));
        expect(groups).toHaveLength(1);
        expect(groups[0].slots).toHaveLength(10);
    });

    it('does not emit an empty group for a double space', () => {
        expect(groupSlots(slots('a  b', [])).every((g) => g.slots.length > 0 || g.trailing)).toBe(true);
    });
});

describe('longestGroupLength', () => {
    it('sizes against the longest word, not the whole phrase', () => {
        expect(longestGroupLength(groupSlots(slots('morning glory', [])))).toBe(7);
    });

    it('is the word length for a single word', () => {
        expect(longestGroupLength(groupSlots(slots('Harmony', [])))).toBe(7);
    });

    it('never returns zero, so the width calculation cannot divide by it', () => {
        expect(longestGroupLength([])).toBe(1);
    });
});

describe('resolvePlacements', () => {
    const pool = (): PoolLetter[] => [
        { id: 'pool-3', char: 'm', slotIndex: null },
        { id: 'pool-5', char: 'n', slotIndex: null },
    ];

    it('binds each typed character to a pool letter', () => {
        const placements = resolvePlacements(pool(), slots('Harmony', ['harpoon'], 'mn'));
        expect(placements.get('pool-3')).toBe(3);
        expect(placements.get('pool-5')).toBe(5);
    });

    it('leaves a typed letter that is not in the pool unbound', () => {
        const placements = resolvePlacements(pool(), slots('Harmony', ['harpoon'], 'x'));
        expect(placements.size).toBe(0);
    });

    it('spends each pool letter once', () => {
        const doubled: PoolLetter[] = [{ id: 'pool-1', char: 'a', slotIndex: null }];
        const placements = resolvePlacements(doubled, slots('banana', [], 'banana'));
        expect(placements.size).toBe(1);
    });

    it('ignores greens, which were never in the pool', () => {
        const placements = resolvePlacements(pool(), slots('Harmony', ['harpoon'], 'mny'));
        expect([...placements.values()].includes(0)).toBe(false);
    });
});
