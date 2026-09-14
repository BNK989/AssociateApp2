import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useDailySettle } from './useDailySettle';
import { DEFAULT_SETTLE_POLICY, type SettlePolicy } from '@/lib/daily/settlePolicy';
import type { Message } from '@/hooks/useGameLogic';
import { MAX_HINT_LEVEL } from '@/lib/gameConfig';

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

/**
 * A word at hint level 2 with every letter exposed as an anagram, which is the
 * state the drip is designed for: the player can read all eight letters and has
 * a place for none of them.
 */
const word = (over: Partial<Message> = {}): Message => ({
    id: 'msg-1',
    content: 'STARLING',
    cipher_length: 8,
    is_solved: false,
    user_id: 'daily-bot',
    created_at: new Date().toISOString(),
    strikes: 0,
    hint_level: 2,
    cipher_text: 'GNILRATS',
    guesses: [],
    ...over,
});

function setup(over: {
    message?: Message;
    policy?: SettlePolicy;
    gameOver?: boolean;
} = {}) {
    const onSettled = vi.fn();
    let message = over.message ?? word();

    // A stand-in for the board: `patchTarget` is how every mutation reaches a
    // message, so the drip is only correct if its writes land the same way.
    const patchTarget = vi.fn((_id: string, updates: Partial<Message>) => {
        message = { ...message, ...updates };
    });

    const view = renderHook((props: { message: Message }) => useDailySettle({
        targetMessage: props.message,
        policy: over.policy ?? policy(),
        gameOver: over.gameOver ?? false,
        patchTarget,
        indexOfMessage: () => 1,
        onSettled,
    }), { initialProps: { message } });

    /** Re-renders with whatever `patchTarget` last wrote, as the board would. */
    const flush = () => view.rerender({ message });

    /** Lands whatever is in the air, as the composer's flight does. */
    const land = () => {
        if (view.result.current.pendingIndex !== null) {
            act(() => view.result.current.onLanded());
        }
    };

    /** Advances the clock, then lets any letter it launched finish its flight. */
    const step = (ms: number) => {
        advance(ms);
        land();
    };

    return { view, patchTarget, onSettled, flush, land, step, current: () => message };
}

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

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

    it('is available at the clue with an empty pool once a game master turns the opening on', () => {
        // The state the setting was written for: at the clue with nothing in the
        // pool there was no offer. Hint 2 fills the pool again, so this is opt-in.
        const { view } = setup({
            message: word({ hint_level: MAX_HINT_LEVEL, cipher_text: undefined }),
            policy: policy({ revealFromHintLevel: MAX_HINT_LEVEL }),
        });

        expect(view.result.current.available).toBe(true);
        expect(view.result.current.lettersLeft).toBeGreaterThan(0);
    });

    it('leaves the opening off on the shipped policy', () => {
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
