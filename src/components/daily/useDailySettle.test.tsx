import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useDailySettle } from './useDailySettle';
import { DEFAULT_SETTLE_POLICY, type SettlePolicy } from '@/lib/daily/settlePolicy';
import type { Message } from '@/hooks/useGameLogic';

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

    return { view, patchTarget, onSettled, flush, current: () => message };
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

    it('is not available with an empty pool', () => {
        // The self-gate: nothing found means nothing to place, so the rung
        // cannot fire before the player has been given something to work with.
        const { view } = setup({ message: word({ cipher_text: undefined }) });
        expect(view.result.current.available).toBe(false);
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

    it('lands a letter the moment the offer is accepted', () => {
        // Accepting has to feel like a reward, not the start of a wait.
        const { view, patchTarget } = setup();

        act(() => view.result.current.accept());

        expect(patchTarget).toHaveBeenCalledTimes(1);
        expect(patchTarget.mock.calls[0][1].settled_indices).toHaveLength(1);
    });

    it('then drips one letter per interval', () => {
        const { view, patchTarget, flush } = setup({ policy: policy({ intervalMs: 10_000 }) });

        act(() => view.result.current.accept());
        flush();
        expect(patchTarget).toHaveBeenCalledTimes(1);

        advance(10_000);
        flush();
        expect(patchTarget).toHaveBeenCalledTimes(2);

        advance(10_000);
        flush();
        expect(patchTarget).toHaveBeenCalledTimes(3);
    });

    it('stops at the allowance rather than finishing the word', () => {
        // STARLING is eight letters; half, leaving at least two, is four.
        const { view, patchTarget, flush, current } = setup({
            policy: policy({ intervalMs: 1_000 }),
        });

        act(() => view.result.current.accept());
        flush();

        for (let i = 0; i < 20; i += 1) {
            advance(1_000);
            flush();
        }

        expect(current().settled_indices!.length).toBeLessThanOrEqual(4);
        expect(patchTarget.mock.calls.length).toBeLessThanOrEqual(4);
    });

    it('leaves letters for the player to solve', () => {
        const { view, flush, current } = setup({ policy: policy({ intervalMs: 1_000 }) });

        act(() => view.result.current.accept());
        flush();
        for (let i = 0; i < 20; i += 1) {
            advance(1_000);
            flush();
        }

        const unsettled = current().content.length - current().settled_indices!.length;
        expect(unsettled).toBeGreaterThanOrEqual(DEFAULT_SETTLE_POLICY.minUnsettled);
    });

    it('never places the same position twice', () => {
        const { view, flush, current } = setup({ policy: policy({ intervalMs: 1_000 }) });

        act(() => view.result.current.accept());
        flush();
        for (let i = 0; i < 10; i += 1) {
            advance(1_000);
            flush();
        }

        const placed = current().settled_indices!;
        expect(new Set(placed).size).toBe(placed.length);
    });
});

describe('auto mode', () => {
    const auto = policy({ mode: 'auto', firstDelayMs: 20_000, intervalMs: 10_000 });

    it('waits out the first delay before placing anything', () => {
        const { patchTarget } = setup({ policy: auto });

        advance(19_000);
        expect(patchTarget).not.toHaveBeenCalled();

        advance(2_000);
        expect(patchTarget).toHaveBeenCalledTimes(1);
    });

    it('credits a wrong guess as dwell, so a player who missed waits less', () => {
        const { patchTarget } = setup({
            message: word({ strikes: 1 }),
            policy: policy({ ...auto, strikeCreditMs: 15_000 }),
        });

        // 5s on the word plus 15s of credit clears the 20s first delay.
        advance(6_000);
        expect(patchTarget).toHaveBeenCalledTimes(1);
    });

    it('places one letter per tick even when several are owed', () => {
        // A player returning to a long-backgrounded tab watches the letters
        // arrive rather than finding the work already done.
        const { patchTarget, flush } = setup({ policy: auto });

        advance(120_000);
        expect(patchTarget).toHaveBeenCalledTimes(1);

        flush();
        advance(1_000);
        expect(patchTarget).toHaveBeenCalledTimes(2);
    });
});

describe('reporting', () => {
    it('announces each letter with the count and the ceiling', () => {
        const { view, onSettled } = setup();

        act(() => view.result.current.accept());

        expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({
            index: 1,
            settledCount: 1,
            allowance: 4,
            source: 'offered',
        }));
    });

    it('reports auto placements as auto, which is the arm of the experiment', () => {
        const { onSettled } = setup({
            policy: policy({ mode: 'auto', firstDelayMs: 1_000 }),
        });

        advance(2_000);
        expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({ source: 'auto' }));
    });
});

describe('moving between words', () => {
    it('does not carry an acceptance onto the next word', () => {
        // Accepting on one word is not consent for the game to place letters on
        // every word after it.
        const { view, patchTarget } = setup({ policy: policy({ intervalMs: 5_000 }) });

        act(() => view.result.current.accept());
        patchTarget.mockClear();

        act(() => view.rerender({ message: word({ id: 'msg-2', content: 'PEACOAT', cipher_text: 'TAOCAEP' }) }));

        advance(120_000);
        expect(patchTarget).not.toHaveBeenCalled();
    });
});
