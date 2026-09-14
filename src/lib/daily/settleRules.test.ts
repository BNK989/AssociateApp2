import { describe, expect, it, vi } from 'vitest';
import {
    canSettle,
    nextSettleIndex,
    orderCandidates,
    settleAllowance,
    settleCandidates,
    revealsUnseen,
} from './settleRules';
import { MAX_HINT_LEVEL } from '@/lib/gameConfig';
import { DEFAULT_SETTLE_POLICY, type SettlePolicy } from './settlePolicy';

/**
 * With the anagram switched on.
 *
 * `HINT_2_WITHHOLDS_POSITIONS` ships on — hint 2 gives letters without their
 * places, orange in the pool. It shipped off for one day (2026-09-13), painting
 * two thirds of the word green in place, and a suite inheriting the switch would
 * have gone quietly vacuous rather than fail. So these cases state the premise.
 * `positionalReveal.test.ts` reads the real value and covers both branches.
 */
vi.mock('@/lib/gameConfig', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/gameConfig')>();
    return { ...actual, HINT_2_WITHHOLDS_POSITIONS: true, maskWithholdsPositions: (level: number) => level >= 2 };
});


const policy = (over: Partial<SettlePolicy> = {}): SettlePolicy => ({
    ...DEFAULT_SETTLE_POLICY,
    ...over,
});

/** A level-2 mask exposing every letter of the word as an anagram. */
const anagramMask = (word: string) => ({
    cipher: [...word].reverse().join(''),
    hintLevel: 2,
});

describe('settleAllowance', () => {
    it('takes the smaller of the fraction and the minimum-unsettled floor', () => {
        // 8 letters, half is 4, floor leaves 6 -> the fraction binds.
        expect(settleAllowance('STARLING', policy({ maxFraction: 0.5, minUnsettled: 2 }))).toBe(4);
        // 8 letters, half is 4, floor leaves 2 -> the floor binds.
        expect(settleAllowance('STARLING', policy({ maxFraction: 0.5, minUnsettled: 6 }))).toBe(2);
    });

    it('never lets the drip finish a short word', () => {
        // The case the absolute floor exists for: half of four is two, which
        // would leave two — but on three letters the fraction alone would leave
        // one, and one letter is not a word the player solved.
        expect(settleAllowance('OPAL', policy())).toBe(2);
        expect(settleAllowance('OAK', policy())).toBe(1);
        expect(settleAllowance('OX', policy())).toBe(0);
    });

    it('counts typeable letters, so scenery does not inflate the allowance', () => {
        // 12 characters, 11 of them typeable: the space is supplied by the strip.
        expect(settleAllowance('MORNING GLORY', policy({ maxFraction: 1, minUnsettled: 0 })))
            .toBe(12);
    });

    it('is never negative when the floor exceeds the word', () => {
        expect(settleAllowance('OPAL', policy({ minUnsettled: 10 }))).toBe(0);
    });
});

describe('orderCandidates', () => {
    const candidates = [0, 1, 2, 3, 4, 5, 6, 7];

    it('left-to-right hands back text order untouched', () => {
        expect(orderCandidates('STARLING', candidates, 'left-to-right')).toEqual(candidates);
    });

    it('seeded is stable for a word and differs between words', () => {
        const once = orderCandidates('STARLING', candidates, 'seeded');
        const again = orderCandidates('STARLING', candidates, 'seeded');
        expect(again).toEqual(once);

        // The trap `scramblePool` documents: a permutation seeded on the index
        // alone is the same permutation for every word of that length, and a
        // player who learns it once can invert it forever.
        expect(orderCandidates('SPARKLED', candidates, 'seeded')).not.toEqual(once);
    });

    it('seeded is not text order', () => {
        expect(orderCandidates('STARLING', candidates, 'seeded')).not.toEqual(candidates);
    });

    it('rare-first gives up the least common letter first', () => {
        // QUARTZ: Z and Q are the two rarest, T the commonest. The point of the
        // ordering is that one settled Q narrows the answer far more than one
        // settled T, for the same cost to the player.
        const order = orderCandidates('QUARTZ', [0, 1, 2, 3, 4, 5], 'rare-first');
        const letters = order.map((i) => 'QUARTZ'[i]);

        expect(letters.slice(0, 2)).toEqual(['Z', 'Q']);
        expect(letters[letters.length - 1]).toBe('T');
    });

    it('falls back to the seeded order for an unranked alphabet', () => {
        // Hebrew letters are all unranked, so rare-first must not collapse to
        // text order — that is the one arrangement that may never leak.
        const word = 'מנורה';
        const all = [0, 1, 2, 3, 4];
        expect(orderCandidates(word, all, 'rare-first'))
            .toEqual(orderCandidates(word, all, 'seeded'));
    });
});

describe('settleCandidates', () => {
    // Level 2: armed, and below the level at which the drip may open a letter
    // the player has not seen. Everything here is therefore the original rule —
    // positions out of the pool, nothing new. The clue level has its own block.
    const base = {
        text: 'STARLING', guesses: [], settled: [], policy: policy(), hintLevel: 2,
    };

    it('is empty with nothing found', () => {
        expect(settleCandidates(base)).toEqual([]);
    });

    it('offers the letters a level-2 anagram exposed, less the free first one', () => {
        const found = settleCandidates({ ...base, mask: anagramMask('STARLING') });

        // Seven, not eight: hint level 1 buys the first letter and every level
        // above it keeps that, so index 0 is already placed and there is
        // nothing left to settle there.
        expect(found).toHaveLength(7);
        expect(found).not.toContain(0);
    });

    it('never offers a position that has already settled', () => {
        const found = settleCandidates({
            ...base,
            mask: anagramMask('STARLING'),
            settled: [3],
        });

        expect(found).not.toContain(3);
        expect(found).toHaveLength(6);
    });

    it('never offers a letter the player has not found', () => {
        // A guess reveals only its own letters, so only those may be placed.
        // This is the rule the whole mechanic rests on: positions, never
        // letters. STARLING against "sting" puts S and T in place — they are
        // green, so they have nothing left to be given — and leaves I, N and G
        // found but homeless, which is exactly the pool.
        const found = settleCandidates({ ...base, guesses: ['sting'] });
        const letters = found.map((i) => 'STARLING'[i].toLowerCase());

        expect(new Set(letters)).toEqual(new Set(['i', 'n', 'g']));
    });

    it('never offers a letter no guess has touched', () => {
        const found = settleCandidates({ ...base, guesses: ['sting'] });
        const letters = found.map((i) => 'STARLING'[i].toLowerCase());

        // A, R and L appear in STARLING but not in the guess, so the player has
        // not found them and the drip must not hand them over.
        expect(letters).not.toContain('a');
        expect(letters).not.toContain('r');
        expect(letters).not.toContain('l');
    });
});

describe('nextSettleIndex', () => {
    const stuck = {
        text: 'STARLING',
        guesses: [],
        mask: anagramMask('STARLING'),
        settled: [],
        policy: policy(),
        hintLevel: 2,
    };

    it('returns a candidate while the allowance holds', () => {
        expect(nextSettleIndex(stuck)).not.toBeNull();
    });

    it('stops at the allowance rather than finishing the word', () => {
        const spent = { ...stuck, settled: [0, 1, 2, 3] };
        expect(settleAllowance(stuck.text, stuck.policy)).toBe(4);
        expect(nextSettleIndex(spent)).toBeNull();
    });

    it('gives nothing when the mode is off', () => {
        expect(nextSettleIndex({ ...stuck, policy: policy({ mode: 'off' }) })).toBeNull();
    });

    it('gives nothing when the pool is empty, whatever the allowance allows', () => {
        // The self-gate, below the reveal level: with nothing found there is
        // nothing to place, so the drip cannot fire before the player has been
        // given something to work with. At the clue it no longer holds, and
        // deliberately — see the block below.
        expect(canSettle({ ...stuck, mask: undefined })).toBe(false);
    });

    it('agrees with canSettle', () => {
        expect(canSettle(stuck)).toBe(true);
        expect(canSettle({ ...stuck, settled: [0, 1, 2, 3] })).toBe(false);
    });
});

describe('at the clue, the drip may open a letter as well as place one', () => {
    // A game-master setting, off by default. Added on the one day hint 2 revealed
    // in place: the pool held only what a wrong guess proved, so at the clue an
    // unguessed word had no candidates, no offer, no button, and the ladder fell
    // straight to the Reveal. Hint 2 fills the pool again; these turn it on.
    const atClue = {
        text: 'STARLING',
        guesses: [],
        settled: [],
        policy: policy({ revealFromHintLevel: MAX_HINT_LEVEL }),
        hintLevel: MAX_HINT_LEVEL,
    };

    it('has something to give on a word the player has not touched', () => {
        expect(canSettle(atClue)).toBe(true);
        expect(settleCandidates(atClue).length).toBeGreaterThan(0);
    });

    it('still leaves the first letter alone, which the player already has', () => {
        expect(settleCandidates(atClue)).not.toContain(0);
    });

    it('spends the pool before it opens anything new', () => {
        // STARLING against "sting": I, N and G are found but homeless, so they
        // are the cheapest thing the drip can give and they go first.
        const found = settleCandidates({ ...atClue, guesses: ['sting'] });
        const pool = new Set(
            settleCandidates({ ...atClue, guesses: ['sting'], hintLevel: 2 }),
        );

        expect(pool.size).toBeGreaterThan(0);
        expect(found.slice(0, pool.size).every((index) => pool.has(index))).toBe(true);
        expect(found.length).toBeGreaterThan(pool.size);
    });

    it('never offers a position the board is already showing', () => {
        const mask = anagramMask('STARLING');
        const shown = new Set(settleCandidates({ ...atClue, mask }));

        // Whatever route a letter reached the player by — pool or line — it is
        // offered at most once, and a settled one never again.
        expect(settleCandidates({ ...atClue, mask, settled: [3] })).not.toContain(3);
        expect(new Set(settleCandidates({ ...atClue, mask })).size).toBe(shown.size);
    });

    it('still cannot solve the word: both ceilings bind', () => {
        const allowance = settleAllowance(atClue.text, atClue.policy);
        const spent = { ...atClue, settled: [1, 2, 3, 4].slice(0, allowance) };

        expect(allowance).toBe(4);
        expect(nextSettleIndex(spent)).toBeNull();
    });

    it('stays pool-only on the shipped policy, which leaves the reveal off', () => {
        expect(DEFAULT_SETTLE_POLICY.revealFromHintLevel).toBeNull();
        expect(canSettle({ ...atClue, policy: policy() })).toBe(false);
    });

    it('is the level, not the arming, that decides it', () => {
        expect(revealsUnseen(2, policy({ revealFromHintLevel: MAX_HINT_LEVEL }))).toBe(false);
        expect(revealsUnseen(MAX_HINT_LEVEL, policy({ revealFromHintLevel: MAX_HINT_LEVEL }))).toBe(true);
        expect(revealsUnseen(MAX_HINT_LEVEL, policy())).toBe(false);
        expect(revealsUnseen(1, policy({ revealFromHintLevel: 1 }))).toBe(true);
    });
});
