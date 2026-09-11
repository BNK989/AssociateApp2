import { describe, expect, it } from 'vitest';
import { buildLetterPool } from './poolRules';

/**
 * The pool's order, which is a rule and not a look.
 *
 * Split out of `poolRules.test.ts` to keep that file under the 350-line cap,
 * and because these are the only tests that assert something about the pool as
 * a *collection* rather than about which letters end up in it.
 */
describe('buildLetterPool — the pool is not in the answer\'s order', () => {
    // 'gnilrats' is 'starling' reversed and shares no position with it, so every
    // letter is revealed and none is green: eight loose tiles, which is the
    // shape where a row in text order hands the word over.
    const loose = (prefix = 'pool-msg1') =>
        buildLetterPool('starling', ['gnilrats'], [], undefined, prefix)
            .map((letter) => letter.char)
            .join('');

    it('does not hand back the letters in the order they appear in the answer', () => {
        expect(loose()).not.toBe('starling');
    });

    it('loses nothing to the scramble — same letters, different order', () => {
        expect([...loose()].sort().join('')).toBe([...'starling'].sort().join(''));
    });

    it('gives the same word the same order on every rebuild', () => {
        expect(loose()).toBe(loose());
    });

    // The trap: a permutation seeded on the index alone is identical for every
    // word of that length, so learning it once inverts it forever.
    it('gives two different words different orders', () => {
        expect(loose('pool-msg1')).not.toBe(loose('pool-msg2'));
    });

    // Guards the avalanche in `scrambleKey`. Tile ids differ only in their last
    // character, so without a final mix the keys come out as `base + n * prime`
    // and the whole permutation is one cyclic sequence rotated: this word
    // scrambled to its exact reverse, and distinct words drew identical orders.
    it('draws a genuinely different permutation per word, not a rotation of one', () => {
        const orders = new Set(
            Array.from({ length: 40 }, (_, n) => loose(`pool-msg-${n}-${(n * 7919).toString(36)}`)),
        );
        expect(orders.size).toBeGreaterThan(30);
        expect(orders.has('starling')).toBe(false);
        expect(orders.has('gnilrats')).toBe(false);
    });

    it('does not reorder the tiles already in the pool when a letter arrives', () => {
        const before = buildLetterPool('starling', ['gnilrat'], [], undefined, 'pool-msg1');
        const after = buildLetterPool('starling', ['gnilrats'], [], undefined, 'pool-msg1');
        const survivors = after.filter((letter) => before.some((was) => was.id === letter.id));
        expect(survivors.map((l) => l.id)).toEqual(before.map((l) => l.id));
    });

    it('does not reorder when a letter is placed', () => {
        const first = buildLetterPool('starling', ['gnilrats'], [], undefined, 'pool-msg1');
        first[2].slotIndex = 4;
        const again = buildLetterPool('starling', ['gnilrats'], first, undefined, 'pool-msg1');
        expect(again.map((l) => l.id)).toEqual(first.map((l) => l.id));
    });

    // From hint 2 the mask is an anagram on purpose. Walking `text` to build the
    // pool sorted it straight back into the answer, which is more than the hint
    // was sold as.
    it('does not sort a hint-2 anagram back into the answer', () => {
        const pool = buildLetterPool('starling', [], [], { cipher: 'gnilrats', hintLevel: 2 });
        // Index 0 is bought by the hint, so 's' is placed and 'tarling' is loose.
        expect(pool.map((l) => l.char).join('')).not.toBe('tarling');
    });
});
