import { describe, expect, it } from 'vitest';
import { CIPHER_SIGNS } from '@/lib/gameConfig';
import {
    buildLetterPool,
    isGapChar,
    nextPoolMatch,
    placedIndices,
    type PoolLetter,
} from './poolRules';
import {
    assembleAttempt,
    buildSlots,
    groupSlots,
    longestGroupLength,
    resolvePlacements,
    typeableIndices,
} from './slotRules';

const slots = (text: string, guesses: string[], typed = '', mode: 'skip' | 'full' = 'skip') =>
    buildSlots({ text, guesses, typed, mode });

describe('isGapChar', () => {
    it('treats a space as a gap', () => {
        expect(isGapChar(' ')).toBe(true);
    });

    it('treats punctuation as a gap, so it is given rather than guessed', () => {
        for (const char of ["'", '-', '.', '&']) expect(isGapChar(char)).toBe(true);
    });

    it('does not treat letters or digits as gaps, in any script', () => {
        for (const char of ['a', 'Z', '7', 'ש', 'ا', 'ä']) expect(isGapChar(char)).toBe(false);
    });
});

describe('buildLetterPool', () => {
    // harpoon aligns h-a-r and the o at index 4; it also proves n is present.
    it('holds a found letter that has no confirmed place', () => {
        const pool = buildLetterPool('Harmony', ['harpoon']);
        expect(pool.map((letter) => letter.char)).toEqual(['n']);
    });

    it('does not hold a letter that is already green', () => {
        const pool = buildLetterPool('Harmony', ['harpoon']);
        expect(pool.some((letter) => letter.char.toLowerCase() === 'h')).toBe(false);
    });

    it('holds one tile per occurrence, not one per character', () => {
        // 'axxxxx' proves 'a' is present without greening any of them.
        const pool = buildLetterPool('banana', ['axxxxx']);
        expect(pool.filter((letter) => letter.char === 'a')).toHaveLength(3);
    });

    it('drops an occurrence from the pool once it turns green', () => {
        const before = buildLetterPool('banana', ['axxxxx']);
        const after = buildLetterPool('banana', ['axxxxx', 'xaxaxa']);
        expect(before.filter((l) => l.char === 'a')).toHaveLength(3);
        // Indices 1, 3 and 5 are now placed, so none of the a's is still adrift.
        expect(after.filter((l) => l.char === 'a')).toHaveLength(0);
    });

    it('never pools a space or punctuation', () => {
        const pool = buildLetterPool("a b-c", ['abc']);
        expect(pool.every((letter) => !isGapChar(letter.char))).toBe(true);
    });

    it('keeps a tile id stable so its identity survives a rebuild', () => {
        const first = buildLetterPool('Harmony', ['harpoon']);
        const second = buildLetterPool('Harmony', ['harpoon'], first);
        expect(second[0].id).toBe(first[0].id);
    });

    it('carries a placement across a rebuild', () => {
        const first = buildLetterPool('Harmony', ['harpoon']);
        first[0].slotIndex = 5;
        expect(buildLetterPool('Harmony', ['harpoon'], first)[0].slotIndex).toBe(5);
    });

    it('is empty before anything has been found', () => {
        expect(buildLetterPool('Harmony', [])).toEqual([]);
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

describe('nextPoolMatch', () => {
    const pool: PoolLetter[] = [
        { id: 'pool-1', char: 'a', slotIndex: null },
        { id: 'pool-3', char: 'a', slotIndex: null },
    ];

    it('draws an unplaced letter', () => {
        expect(nextPoolMatch(pool, new Map(), 'a')?.id).toBe('pool-1');
    });

    it('draws the next occurrence once the first is placed', () => {
        expect(nextPoolMatch(pool, new Map([['pool-1', 0]]), 'a')?.id).toBe('pool-3');
    });

    it('matches regardless of case', () => {
        expect(nextPoolMatch(pool, new Map(), 'A')?.id).toBe('pool-1');
    });

    it('returns nothing when the letter is not in the pool', () => {
        expect(nextPoolMatch(pool, new Map(), 'z')).toBeUndefined();
    });
});

describe('placedIndices', () => {
    it('counts a green', () => {
        expect([...placedIndices('Harmony', ['harpoon'])].sort((a, b) => a - b)).toEqual([0, 1, 2, 4]);
    });

    it('counts a positional reveal from the mask below hint 2', () => {
        // The line draws this letter as confirmed, so the strip must give it
        // to the player rather than ask them to type it.
        const placed = placedIndices('Harmony', [], { cipher: 'H######', hintLevel: 1 });
        expect(placed.has(0)).toBe(true);
    });

    it('ignores an anagram mask from hint 2, apart from the first letter', () => {
        const placed = placedIndices('Harmony', [], { cipher: 'yHramno', hintLevel: 2 });
        expect([...placed]).toEqual([0]);
    });

    // The strip must not ask the player to type a letter they already bought.
    it('counts the first letter from hint 1 upward', () => {
        for (const hintLevel of [1, 2, 3]) {
            expect(placedIndices('Harmony', [], { cipher: '#######', hintLevel }).has(0)).toBe(true);
        }
    });

    it('does not count it below hint 1', () => {
        // A mask of real filler: '#' is not in CIPHER_SIGNS, so the positional
        // pass would read it as a letter the mask had revealed.
        const masked = CIPHER_SIGNS[0].repeat(7);
        expect(placedIndices('Harmony', [], { cipher: masked, hintLevel: 0 }).has(0)).toBe(false);
    });
});

describe('buildLetterPool — letters bought with a hint', () => {
    // Without this the level-2 hint would reveal nothing: its letters no longer
    // appear in the word line, so the pool is the only place left for them.
    it('pools the letters an anagram mask exposes', () => {
        const pool = buildLetterPool('Harmony', [], [], { cipher: 'yHramno', hintLevel: 2 });
        expect(pool.length).toBeGreaterThan(0);
    });

    it('pools no more of a letter than the mask actually shows', () => {
        // The mask exposes one 'a'; BANANA has three, and none was guessed.
        const pool = buildLetterPool('banana', [], [], { cipher: 'a#####', hintLevel: 2 });
        expect(pool.filter((letter) => letter.char.toLowerCase() === 'a')).toHaveLength(1);
    });

    it('does not pool the first letter once a hint has bought it', () => {
        const pool = buildLetterPool('Harmony', ['harpoon'], [], { cipher: '#######', hintLevel: 2 });
        expect(pool.some((letter) => letter.id === 'pool-0')).toBe(false);
    });

    it('does not pool a letter already confirmed by the mask below hint 2', () => {
        const pool = buildLetterPool('Harmony', [], [], { cipher: 'H######', hintLevel: 1 });
        expect(pool.some((letter) => letter.char === 'H')).toBe(false);
    });

    it('still pools every occurrence of a guessed letter', () => {
        const pool = buildLetterPool('banana', ['axxxxx'], [], { cipher: '######', hintLevel: 2 });
        expect(pool.filter((letter) => letter.char === 'a')).toHaveLength(3);
    });
});

describe('buildLetterPool — tile identity across words', () => {
    // The defect: keyed on position alone, the next word's tiles inherited the
    // previous word's DOM elements. React saw the same keys, swapped the
    // characters in place, and no tile ever animated in.
    it('gives two different words different tile ids', () => {
        const first = buildLetterPool('Harmony', ['harpoon'], [], undefined, 'pool-msg1');
        const second = buildLetterPool('Harmony', ['harpoon'], [], undefined, 'pool-msg2');
        expect(first[0].id).not.toBe(second[0].id);
    });

    it('keeps an id stable across rebuilds of the same word', () => {
        const first = buildLetterPool('Harmony', ['harpoon'], [], undefined, 'pool-msg1');
        const again = buildLetterPool('Harmony', ['harpoon'], first, undefined, 'pool-msg1');
        expect(again[0].id).toBe(first[0].id);
    });
});
