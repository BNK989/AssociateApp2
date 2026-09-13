import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { MAX_HINT_LEVEL } from '@/lib/gameConfig';
import { advance, policy, setup, word, COMMIT_FALLBACK_MS } from './useDailySettle.harness';

/**
 * The drip's timing modes, its reporting, and moving between words.
 *
 * Split from `useDailySettle.test.tsx` on 2026-09-13 for the line cap; the rig
 * they share is `useDailySettle.harness.tsx`. With the anagram switched on.
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

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());


describe('auto mode', () => {
    const auto = policy({ mode: 'auto', firstDelayMs: 20_000, intervalMs: 10_000 });

    it('waits out the first delay before placing anything', () => {
        const { view, patchTarget } = setup({ policy: auto });

        advance(19_000);
        expect(view.result.current.pendingIndex).toBeNull();

        advance(2_000);
        expect(view.result.current.pendingIndex).not.toBeNull();

        advance(COMMIT_FALLBACK_MS);
        expect(patchTarget).toHaveBeenCalledTimes(1);
    });

    it('credits a wrong guess as dwell, so a player who missed waits less', () => {
        const { patchTarget, step } = setup({
            message: word({ strikes: 1 }),
            policy: policy({ ...auto, strikeCreditMs: 15_000 }),
        });

        // 5s on the word plus 15s of credit clears the 20s first delay.
        step(6_000);
        expect(patchTarget).toHaveBeenCalledTimes(1);
    });

    it('drains a backlog one letter at a time rather than in a batch', () => {
        // A player returning to a long-backgrounded tab watches the letters
        // arrive rather than finding the work already done. Each one has to
        // wait for the one before it to land, so the writes step up by one and
        // never jump.
        const { patchTarget, flush, step } = setup({ policy: auto });

        for (let i = 0; i < 12; i += 1) {
            step(10_000);
            flush();
        }

        patchTarget.mock.calls.forEach((call, i) => {
            expect(call[1].settled_indices).toHaveLength(i + 1);
        });

        // And the ceiling still binds, however much time was owed.
        expect(patchTarget.mock.calls.length).toBeLessThanOrEqual(4);
        expect(patchTarget.mock.calls.length).toBeGreaterThan(1);
    });

    it('never puts a second letter in the air while one is still flying', () => {
        // Two letters mid-flight would land on top of each other, and the
        // ceiling would be spent before either was written down.
        const { view, patchTarget } = setup({ policy: auto });

        advance(21_000);
        expect(view.result.current.pendingIndex).not.toBeNull();

        const airborne = view.result.current.pendingIndex;
        advance(COMMIT_FALLBACK_MS - 100);

        expect(view.result.current.pendingIndex).toBe(airborne);
        expect(patchTarget).not.toHaveBeenCalled();
    });
});

describe('reporting', () => {
    it('announces each letter with the count and the ceiling, once it lands', () => {
        const { view, onSettled } = setup();

        act(() => view.result.current.accept());
        // Nothing is reported while the letter is in the air: a flight that
        // never arrives must cost the player nothing.
        expect(onSettled).not.toHaveBeenCalled();

        act(() => view.result.current.onLanded());

        expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({
            index: 1,
            settledCount: 1,
            allowance: 4,
            source: 'offered',
        }));
    });

    it('reports auto placements as auto, which is the arm of the experiment', () => {
        const { onSettled, step } = setup({
            policy: policy({ mode: 'auto', firstDelayMs: 1_000 }),
        });

        step(2_000);
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
