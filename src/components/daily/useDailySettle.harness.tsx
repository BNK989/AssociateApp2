import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useDailySettle } from './useDailySettle';
import { DEFAULT_SETTLE_POLICY, type SettlePolicy } from '@/lib/daily/settlePolicy';
import type { Message } from '@/hooks/useGameLogic';

/**
 * The shared rig for the settle drip's hook suites.
 *
 * Lifted out of `useDailySettle.test.tsx` on 2026-09-13: the rig was a hundred
 * lines and the file had grown past the 350-line cap carrying it plus every
 * mode. Not named `*.test.tsx`, so vitest does not collect it.
 *
 * The `vi.mock('@/lib/gameConfig', ...)` that switches the anagram on stays in
 * each test file rather than moving here — `vi.mock` is hoisted per test module
 * and would not apply if it were declared in an import. Fake timers are each
 * file's to install for the same reason: a `beforeEach` here would fire on
 * import, which is a side effect a helper module has no business having.
 */
export const policy = (over: Partial<SettlePolicy> = {}): SettlePolicy => ({
    ...DEFAULT_SETTLE_POLICY,
    ...over,
});

/**
 * A word at hint level 2 with every letter exposed as an anagram, which is the
 * state the drip is designed for: the player can read all eight letters and has
 * a place for none of them.
 */
export const word = (over: Partial<Message> = {}): Message => ({
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

export function setup(over: {
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

export const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

/**
 * Past the commit backstop in `useSettlePlacement`, so a letter that was
 * announced is written even though no flight ever ran. Only used by the test
 * that covers the backstop itself; everything else lands the flight explicitly,
 * because that is the path a real player takes.
 */
export const COMMIT_FALLBACK_MS = 700;
