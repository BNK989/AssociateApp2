import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { MAX_HINT_LEVEL } from '@/lib/gameConfig';
import { DEFAULT_SETTLE_POLICY } from '@/lib/daily/settlePolicy';
import { advance, policy, setup, word, COMMIT_FALLBACK_MS } from './useDailySettle.harness';

/**
 * With the anagram switched on.
 *
 * `SCRAMBLE_MASK` ships off — hint 2 withholds position rather than shuffling
 * the line now, so a suite written against the shuffled mask would quietly stop
 * exercising anything rather than fail. The mechanic still exists behind the
 * switch for a game master to turn back on, so these cases state the premise
 * instead of inheriting it.
 */
vi.mock('@/lib/gameConfig', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/gameConfig')>();
    return { ...actual, SCRAMBLE_MASK: true, maskIsScrambled: (level: number) => level >= 2 };
});


describe('availability', () => {
    it('is available on a word at the arming level with letters to place', () => {
        const { view } = setup();
        expect(view.result.current.available).toBe(true);
    });

    it('is not available below the arming level', () => {
        const { view } = setup({ message: word({ hint_level: 1 }) });
        expect(view.result.current.available).toBe(false);
    });

    it('is not available with an empty pool below the reveal level', () => {
        // The self-gate: nothing found means nothing to place, so the rung
        // cannot fire before the player has been given something to work with.
        const { view } = setup({ message: word({ cipher_text: undefined }) });
        expect(view.result.current.available).toBe(false);
    });

    it('is available at the clue with an empty pool when a game master allows it', () => {
        // Opening unseen letters is off in the shipped policy, so this states
        // the premise. See `settleRules.test.ts` for why it is off.
        const { view } = setup({
            message: word({ hint_level: MAX_HINT_LEVEL, cipher_text: undefined }),
            policy: policy({ revealFromHintLevel: MAX_HINT_LEVEL }),
        });

        expect(view.result.current.available).toBe(true);
        expect(view.result.current.lettersLeft).toBeGreaterThan(0);
    });

    it('is pool-only at the clue by default, which is what ships', () => {
        const { view } = setup({
            message: word({ hint_level: MAX_HINT_LEVEL, cipher_text: undefined }),
        });

        expect(view.result.current.available).toBe(false);
    });

    it('places an opened letter when the player accepts it', () => {
        const { view, patchTarget, land } = setup({
            message: word({ hint_level: MAX_HINT_LEVEL, cipher_text: undefined }),
            policy: policy({ revealFromHintLevel: MAX_HINT_LEVEL }),
        });

        act(() => view.result.current.accept());
        land();

        const [, updates] = patchTarget.mock.calls[0];
        expect(updates.settled_indices).toHaveLength(1);
        // Never the first letter: hint 1 bought that one already.
        expect(updates.settled_indices).not.toContain(0);
    });

    it('is not available once the game is over', () => {
        const { view } = setup({ gameOver: true });
        expect(view.result.current.available).toBe(false);
    });

    it('is not available when the mode is off', () => {
        const { view } = setup({ policy: policy({ mode: 'off' }) });
        expect(view.result.current.available).toBe(false);
    });
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());


describe('offered mode', () => {
    it('places nothing until the player accepts', () => {
        const { patchTarget } = setup();
        advance(120_000);
        expect(patchTarget).not.toHaveBeenCalled();
    });

    it('puts a letter in the air the moment the offer is accepted', () => {
        // Accepting has to feel like a reward, not the start of a wait.
        const { view, patchTarget } = setup();

        act(() => view.result.current.accept());

        // Announced, not yet written: the composer needs the letter still in
        // the pool to have something to fly.
        expect(view.result.current.pendingIndex).not.toBeNull();
        expect(patchTarget).not.toHaveBeenCalled();

        act(() => view.result.current.onLanded());

        expect(patchTarget).toHaveBeenCalledTimes(1);
        expect(patchTarget.mock.calls[0][1].settled_indices).toHaveLength(1);
    });

    it('then drips one letter per interval', () => {
        const { view, patchTarget, flush, land, step } = setup({
            policy: policy({ intervalMs: 10_000 }),
        });

        act(() => view.result.current.accept());
        land();
        flush();
        expect(patchTarget).toHaveBeenCalledTimes(1);

        step(10_000);
        flush();
        expect(patchTarget).toHaveBeenCalledTimes(2);

        step(10_000);
        flush();
        expect(patchTarget).toHaveBeenCalledTimes(3);
    });

    it('stops at the allowance rather than finishing the word', () => {
        // STARLING is eight letters; half, leaving at least two, is four.
        const { view, patchTarget, flush, land, step, current } = setup({
            policy: policy({ intervalMs: 1_000 }),
        });

        act(() => view.result.current.accept());
        land();
        flush();

        for (let i = 0; i < 20; i += 1) {
            step(1_000);
            flush();
        }

        expect(current().settled_indices!.length).toBeLessThanOrEqual(4);
        expect(patchTarget.mock.calls.length).toBeLessThanOrEqual(4);
    });

    it('leaves letters for the player to solve', () => {
        const { view, flush, land, step, current } = setup({
            policy: policy({ intervalMs: 1_000 }),
        });

        act(() => view.result.current.accept());
        land();
        flush();
        for (let i = 0; i < 20; i += 1) {
            step(1_000);
            flush();
        }

        const unsettled = current().content.length - current().settled_indices!.length;
        expect(unsettled).toBeGreaterThanOrEqual(DEFAULT_SETTLE_POLICY.minUnsettled);
    });

    it('never places the same position twice', () => {
        const { view, flush, land, step, current } = setup({
            policy: policy({ intervalMs: 1_000 }),
        });

        act(() => view.result.current.accept());
        land();
        flush();
        for (let i = 0; i < 10; i += 1) {
            step(1_000);
            flush();
        }

        const placed = current().settled_indices!;
        expect(new Set(placed).size).toBe(placed.length);
    });
});
