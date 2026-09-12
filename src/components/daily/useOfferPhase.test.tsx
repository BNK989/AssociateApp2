import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLAPSE_AFTER_MS, TRANSIENT_HOLD_MS } from '@/lib/daily/offerPresentation';
import type { StuckOfferKind } from '@/lib/daily/stuckSignals';
import { useOfferPhase } from './useOfferPhase';

const setup = (kind: StuckOfferKind | null) =>
    renderHook(({ k }: { k: StuckOfferKind | null }) => useOfferPhase(k), {
        initialProps: { k: kind },
    });

const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('useOfferPhase', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('gives every offer its turn at full width', () => {
        expect(setup('stake').result.current.phase).toBe('expanded');
        expect(setup('letter').result.current.phase).toBe('expanded');
    });

    it('ends a remark and parks a route out', () => {
        const remark = setup('stake');
        wait(TRANSIENT_HOLD_MS);
        expect(remark.result.current.phase).toBe('gone');

        const route = setup('other_end');
        wait(COLLAPSE_AFTER_MS);
        expect(route.result.current.phase).toBe('collapsed');
    });

    it('holds the offer up while the player is still reading it', () => {
        const { result } = setup('letter');
        wait(COLLAPSE_AFTER_MS - 1);
        expect(result.current.phase).toBe('expanded');
    });

    /**
     * The hold is the game's one attempt at stepping aside politely. A player
     * who taps the chip open has said what they want, and collapsing it again
     * under them would be the game arguing.
     */
    it('does not take a reopened offer away again', () => {
        const { result } = setup('reveal');

        wait(COLLAPSE_AFTER_MS);
        act(() => result.current.expand());
        wait(COLLAPSE_AFTER_MS * 3);

        expect(result.current.phase).toBe('expanded');
    });

    it('starts the offer that escalates over it from the top', () => {
        const { result, rerender } = setup('stake');

        wait(TRANSIENT_HOLD_MS);
        rerender({ k: 'other_end' });

        expect(result.current.phase).toBe('expanded');
    });

    /**
     * The regression this guards: without clearing on the silence between
     * words, the next word's remark inherited the last one's spent phase and
     * was never seen at all.
     */
    it('does not carry a spent phase into the next word', () => {
        const { result, rerender } = setup('stake');

        wait(TRANSIENT_HOLD_MS);
        expect(result.current.phase).toBe('gone');

        rerender({ k: null });     // the quiet start of the next word
        rerender({ k: 'stake' });

        expect(result.current.phase).toBe('expanded');
    });
});
