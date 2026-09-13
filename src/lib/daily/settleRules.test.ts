import { describe, expect, it , vi } from 'vitest';
import {
    canSettle,
    settleCountdown,
    nextSettleIndex,
    orderCandidates,
    settleAllowance,
    settleArmed,
    settleCandidates,
    settlePressure,
    settlesDueBy,
    revealsUnseen,
} from './settleRules';
import { MAX_HINT_LEVEL } from '@/lib/gameConfig';
import { DEFAULT_SETTLE_POLICY, type SettlePolicy } from './settlePolicy';

/**
 * With the anagram switched on.
 *
 * `SCRAMBLE_MASK` ships off — hint 2 reveals its letters in place now, so a
 * suite written against the shuffled mask would quietly stop exercising
 * anything rather than fail. The mechanic still exists behind the switch for a
 * game master to turn back on, so these cases state the premise instead of
 * inheriting it.
 */
vi.mock('@/lib/gameConfig', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/gameConfig')>();
    return { ...actual, SCRAMBLE_MASK: true, maskIsScrambled: (level: number) => level >= 2 };
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

describe('settleArmed', () => {
    it('holds the rung back until the word is far enough up the ladder', () => {
        expect(settleArmed(0, policy())).toBe(false);
        expect(settleArmed(1, policy())).toBe(false);
        expect(settleArmed(2, policy())).toBe(true);
        expect(settleArmed(3, policy())).toBe(true);
    });

    it('is never armed when the mode is off', () => {
        expect(settleArmed(3, policy({ mode: 'off' }))).toBe(false);
    });
});

describe('settlePressure and settlesDueBy', () => {
    it('credits a wrong guess as dwell, like the stuck offer does', () => {
        const p = policy({ strikeCreditMs: 12_000 });
        expect(settlePressure({ msOnWord: 1_000, strikes: 2 }, p)).toBe(25_000);
    });

    it('owes nothing before the first delay', () => {
        const p = policy({ firstDelayMs: 20_000, intervalMs: 15_000 });
        expect(settlesDueBy(19_999, p)).toBe(0);
        expect(settlesDueBy(20_000, p)).toBe(1);
    });

    it('counts one more per interval after that', () => {
        const p = policy({ firstDelayMs: 20_000, intervalMs: 15_000 });
        expect(settlesDueBy(34_999, p)).toBe(1);
        expect(settlesDueBy(35_000, p)).toBe(2);
        expect(settlesDueBy(50_000, p)).toBe(3);
    });

    it('is derived from elapsed time, so a throttled tab converges rather than drifts', () => {
        // The property that matters: a tab backgrounded for five minutes owes
        // the same count as one that ticked the whole way through.
        const p = policy({ firstDelayMs: 20_000, intervalMs: 15_000 });
        expect(settlesDueBy(320_000, p)).toBe(21);
    });
});

describe('settleCountdown', () => {
    const p = policy({ firstDelayMs: 20_000, intervalMs: 10_000 });

    it('counts toward the first letter before it has landed', () => {
        expect(settleCountdown(5_000, p, false)).toEqual({
            msUntilNext: 15_000,
            progressPercent: 25,
        });
    });

    it('skips the first delay once the drip has started', () => {
        // In `offered` mode the player has already been given a letter, so the
        // wait they are watching is the interval, not the opening delay.
        expect(settleCountdown(0, p, true)).toEqual({
            msUntilNext: 10_000,
            progressPercent: 0,
        });
    });

    it('counts up, so a full ring means a letter is landing', () => {
        // The opposite direction from the auto-hint ring, which drains. That
        // clock takes points away; this one brings a letter.
        expect(settleCountdown(9_000, p, true).progressPercent).toBe(90);
    });

    it('restarts at every interval boundary', () => {
        expect(settleCountdown(10_000, p, true).progressPercent).toBe(0);
        expect(settleCountdown(15_000, p, true).progressPercent).toBe(50);
        expect(settleCountdown(20_000, p, true).progressPercent).toBe(0);
    });

    it('stays inside 0–100 whatever it is handed', () => {
        for (const ms of [-1, 0, 1e9, NaN]) {
            const { progressPercent } = settleCountdown(ms, p, true);
            expect(progressPercent).toBeGreaterThanOrEqual(0);
            expect(progressPercent).toBeLessThanOrEqual(100);
        }
    });
});
