import { describe, expect, it } from 'vitest';
import { MASK_WITHHOLDS_POSITION_FROM, maskGivesPosition } from '@/lib/gameConfig';
import { generateCipherString } from '@/lib/gameLogic';
import { buildLetterPool, knownUnplacedIndices, placedIndices } from './poolRules';

/**
 * **Does the halo have anything in it?** Asked of the shipped configuration,
 * with nothing mocked.
 *
 * This is the case that was missing, and its absence is the whole story of the
 * orange letters going dark. Ten suites over this surface open with
 * `vi.mock('@/lib/gameConfig', ...)` forcing `SCRAMBLE_MASK: true`, because that
 * was the only way to get a populated pool to test against. So every assertion
 * about the pool described a game that does not ship, all of them stayed green,
 * and the one suite reading the real config had been written to assert the pool
 * was *empty*.
 *
 * Nothing here mocks anything. If a change starves the halo again, this fails.
 *
 * What it deliberately does not pin: which letters, how many, or the shape of
 * the mask. `MASK_WITHHOLDS_POSITION_FROM` is a tunable and the reveal fraction
 * is a game-master setting, so the assertions are about the *route* a disclosed
 * letter takes, which is the thing that must not silently change.
 */

/** Long enough that 66% of it is several letters, with a repeat to catch budgets. */
const WORD = 'starling';

const maskAt = (level: number) => ({
    cipher: generateCipherString(WORD, level, true),
    hintLevel: level,
});

/** Letters the mask discloses, counted at the source rather than inferred. */
function revealedByMask(cipher: string): number {
    const chars = [...WORD];
    return [...cipher].filter((char, index) => char === chars[index]).length;
}

describe('the halo is fed by hints, not only by wrong guesses', () => {
    it('is a real setting, or these cases have nothing to say', () => {
        // Guards against the suite going vacuous the way the last one did: if
        // position is never withheld, the pool has no hint-fed supply at all and
        // that is a product decision someone must make on purpose.
        expect(MASK_WITHHOLDS_POSITION_FROM).not.toBeNull();
        expect(maskGivesPosition(MASK_WITHHOLDS_POSITION_FROM as number)).toBe(false);
    });

    it('puts the letters hint 2 discloses into the pool, on a word never guessed at', () => {
        const mask = maskAt(2);
        const pool = buildLetterPool(WORD, [], [], mask, 'pool-x');

        // The bug, stated as the player met it: a full clue, and an empty halo.
        expect(pool.length).toBeGreaterThan(0);
        expect(pool.map((letter) => letter.char).join('')).not.toBe('');
    });

    it('does not hand those letters over pre-placed', () => {
        const mask = maskAt(2);
        const placed = placedIndices(WORD, [], mask);

        // Only the first letter, which hint 1 bought and the player already has.
        // Anything more is the game solving its own puzzle in the word line —
        // which is exactly what shipped: `s t a _ l i _ g`, green, in order.
        expect([...placed]).toEqual([0]);
    });

    it('discloses as many letters as the mask holds, and no more', () => {
        const mask = maskAt(2);
        const pool = knownUnplacedIndices(WORD, [], mask);
        const placed = placedIndices(WORD, [], mask);

        // Nothing dropped on the floor, and nothing invented: the first letter
        // is placed and the rest of the mask's letters are adrift.
        expect(pool.length + placed.size).toBe(revealedByMask(mask.cipher));
    });

    it('spends the first letter out of the budget instead of pooling it twice', () => {
        // An in-order mask holds hint 1's first letter at its own index, so that
        // letter is both green in the line and counted in the pool's budget. A
        // word with two of it pooled the second one on a mask that had only ever
        // shown the first.
        const word = 'sisters';
        const mask = { cipher: 's#s####', hintLevel: 2 };
        const pool = buildLetterPool(word, [], [], mask, 'pool-x');

        // The mask shows two esses and one of them is green at index 0, so
        // exactly one may be adrift.
        expect(pool.filter((letter) => letter.char.toLowerCase() === 's')).toHaveLength(1);
    });

    it('keeps the pool empty below the withholding level', () => {
        for (const level of [0, 1]) {
            expect(knownUnplacedIndices(WORD, [], maskAt(level))).toEqual([]);
        }
    });

    it('still lets a wrong guess feed the pool at level 0', () => {
        // The route that survived the regression, kept under test so a future
        // change to the mask path cannot take it out on the way past.
        const pool = buildLetterPool(WORD, ['sting'], [], maskAt(0), 'pool-x');

        // "sting" against "starling": s and t are right in place and go green,
        // so only i, n and g are proved-but-homeless.
        expect(pool.map((letter) => letter.char).sort()).toEqual(['g', 'i', 'n']);
    });
});

describe('a hint adds to the picture and never takes one away', () => {
    it('leaves the first letter placed at every level from 1 up', () => {
        // The reason the scramble was switched off: level 2 used to take away
        // the position level 1 had sold. Withholding position in the *pool*
        // rather than in the *line* is what lets both be true at once.
        for (const level of [1, 2, 3]) {
            const mask = maskAt(Math.min(level, 2));
            expect(placedIndices(WORD, [], { ...mask, hintLevel: level }).has(0)).toBe(true);
        }
    });

    it('never un-places a letter the player earned', () => {
        const mask = maskAt(2);
        const placed = placedIndices(WORD, ['starxxxx'], mask);

        // s, t, a, r guessed in position stay green whatever the mask withholds.
        expect([...placed].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    });
});
