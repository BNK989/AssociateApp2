import { describe, expect, it, vi } from 'vitest';
import {
    canSettle,
    nextSettleIndex,
    settleAllowance,
    settleCandidates,
    revealsUnseen,
} from './settleRules';
import { MAX_HINT_LEVEL } from '@/lib/gameConfig';
import { DEFAULT_SETTLE_POLICY, type SettlePolicy } from './settlePolicy';

/**
 * The drip's optional second job: opening a letter the player has not seen,
 * rather than only placing one already hanging in the halo.
 *
 * Split out of `settleRules.test.ts` on 2026-09-13, which had grown past the
 * 350-line cap. It is a clean seam: this is one setting's worth of behaviour,
 * it is **off in the shipped policy**, and every case here has to say so.
 *
 * With the anagram switched on, as the rest of this surface's suites do — the
 * mechanic still exists behind `SCRAMBLE_MASK` for a game master to turn back
 * on, so these cases state the premise instead of inheriting it.
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

describe('at the clue, the drip may open a letter as well as place one', () => {
    // A game-master option, and **off by default** — `revealFromHintLevel` is
    // null in the compiled policy, so every case here states the premise rather
    // than inheriting it.
    //
    // It shipped on for a day on the reasoning that the pool was empty at the
    // clue, so the rung had quietly stopped existing. The emptiness was real and
    // the diagnosis was wrong: hint 2's letters were being drawn in the line as
    // greens instead of pooled, because `readMaskTile` and `placedIndices` were
    // asking `maskIsScrambled` where they meant `maskGivesPosition`. Opening
    // unseen letters was a second mechanic compensating for the first being
    // broken, and it made the giveaway worse. See `MASK_WITHHOLDS_POSITION_FROM`.
    const opens = policy({ revealFromHintLevel: MAX_HINT_LEVEL });

    const atClue = {
        text: 'STARLING',
        guesses: [],
        settled: [],
        policy: opens,
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

    it('is pool-only by default, which is what ships', () => {
        expect(policy().revealFromHintLevel).toBeNull();
        expect(canSettle({ ...atClue, policy: policy() })).toBe(false);
    });

    it('is the level, not the arming, that decides it', () => {
        expect(revealsUnseen(2, opens)).toBe(false);
        expect(revealsUnseen(MAX_HINT_LEVEL, opens)).toBe(true);
        expect(revealsUnseen(MAX_HINT_LEVEL, policy({ revealFromHintLevel: null }))).toBe(false);
        expect(revealsUnseen(1, policy({ revealFromHintLevel: 1 }))).toBe(true);
    });
});
