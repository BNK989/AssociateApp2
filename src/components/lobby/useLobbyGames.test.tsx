import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

/** One deferred answer per call, so a test can decide what each fetch returns. */
const answers: Array<{ data: unknown; error: unknown }> = [];
const order = vi.fn(() => Promise.resolve(answers.shift() ?? { data: [], error: null }));

vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: () => ({ select: () => ({ eq: () => ({ order }) }) }),
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        removeChannel: vi.fn(),
    },
}));

import { useLobbyGames } from './useLobbyGames';

const user = { id: 'u1' } as User;
const abort = { message: 'signal is aborted without reason' };

describe('useLobbyGames', () => {
    beforeEach(() => {
        answers.length = 0;
        toastError.mockClear();
        order.mockClear();
    });

    it('loads games and clears the spinner', async () => {
        answers.push({ data: [], error: null });
        const { result } = renderHook(() => useLobbyGames(user));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(toastError).not.toHaveBeenCalled();
    });

    /**
     * The reported bug. The browser aborts in-flight fetches when a tab is
     * frozen or a page navigates, and the player was shown
     * "loading games failed: AbortError: signal is aborted without reason" —
     * an error for something that did not fail, worded so they could do
     * nothing with it.
     */
    it('never reports a cancelled fetch as a failure', async () => {
        answers.push({ data: null, error: abort }, { data: [], error: null });
        const { result } = renderHook(() => useLobbyGames(user));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(toastError).not.toHaveBeenCalled();
    });

    // Swallowing the error is only half of it: a cancelled *first* fetch would
    // otherwise leave the lobby showing "no games yet", which is a worse lie.
    it('retries once so a cancellation does not leave the lobby empty', async () => {
        answers.push({ data: null, error: abort }, { data: [], error: null });
        renderHook(() => useLobbyGames(user));

        await waitFor(() => expect(order).toHaveBeenCalledTimes(2));
    });

    it('gives up quietly rather than retrying forever', async () => {
        answers.push({ data: null, error: abort }, { data: null, error: abort });
        const { result } = renderHook(() => useLobbyGames(user));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(order).toHaveBeenCalledTimes(2);
        expect(toastError).not.toHaveBeenCalled();
    });

    // The guard must not swallow the failures a player genuinely needs to see.
    it('still reports a real failure', async () => {
        answers.push({ data: null, error: { message: 'permission denied for table games' } });
        const { result } = renderHook(() => useLobbyGames(user));

        await waitFor(() => expect(toastError).toHaveBeenCalled());
        expect(result.current.loading).toBe(false);
    });

    it('does nothing at all without a signed-in user', async () => {
        const { result } = renderHook(() => useLobbyGames(null));

        await act(async () => {});
        expect(order).not.toHaveBeenCalled();
        expect(result.current.activeGames).toEqual([]);
    });
});
