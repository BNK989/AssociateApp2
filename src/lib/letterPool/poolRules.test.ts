import { describe, expect, it , vi } from 'vitest';
import { CIPHER_SIGNS } from '@/lib/gameConfig';
import {
    buildLetterPool,
    scramblePool,
    withAnnounced,
    isGapChar,
    knownUnplacedIndices,
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
/** With the anagram on: it ships off, and these cases are about the anagram. */
vi.mock('@/lib/gameConfig', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/gameConfig')>(),
    SCRAMBLE_MASK: true,
    maskIsScrambled: (level: number) => level >= 2,
}));

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

describe('withAnnounced', () => {
    // What lets the drip open a letter that was never loose: it joins the pool
    // for the length of its flight, so it has a chip to leave from instead of
    // arriving by teleport.
    const prefix = 'pool-msg1';

    it('lends a chip to a letter the pool does not hold', () => {
        const lent = withAnnounced([], 'STARLING', 3, prefix);

        expect(lent.map((letter) => letter.id)).toEqual([`${prefix}-3`]);
        expect(lent[0].char).toBe('R');
        expect(lent[0].slotIndex).toBeNull();
    });

    it('leaves a pool that already holds it exactly as it was', () => {
        const pool = buildLetterPool('STARLING', ['sting'], [], undefined, prefix);
        const index = Number(pool[0].id.slice(prefix.length + 1));

        expect(withAnnounced(pool, 'STARLING', index, prefix)).toBe(pool);
    });

    it('refuses a position that is not a letter', () => {
        const pool = withAnnounced([], 'MORNING GLORY', 7, prefix);
        expect(pool).toEqual([]);
    });

    it('seeds the lent chip into the arrangement rather than onto the end', () => {
        // Same order the pool would have had if the letter had been found: the
        // halo must not reshuffle around a letter that is about to leave it.
        const found = buildLetterPool('STARLING', ['sting'], [], undefined, prefix);
        const lent = withAnnounced(found, 'STARLING', 2, prefix);

        expect(lent).toEqual(scramblePool([
            ...found, { id: `${prefix}-2`, char: 'A', slotIndex: null },
        ]));
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
