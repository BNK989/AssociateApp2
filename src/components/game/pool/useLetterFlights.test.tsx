import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HaloPlacement } from '@/lib/letterPool/haloLayout';
import { useLetterFlights } from './useLetterFlights';

/**
 * Both ends of a flight have to be measurable or nothing launches, so every
 * lookup returns a real rectangle.
 */
const stub = (left: number, top: number) => ({
    getBoundingClientRect: () => ({
        left, top, right: left + 30, bottom: top + 30, width: 30, height: 30, x: left, y: top,
        toJSON: () => ({}),
    }),
}) as unknown as HTMLElement;

beforeEach(() => {
    // The chip hangs by the bubble, the cell sits in the composer: two ends far
    // enough apart to be worth animating between.
    vi.spyOn(document, 'getElementById').mockImplementation(() => stub(0, 0));
    vi.spyOn(document, 'querySelector').mockImplementation(() => stub(120, 400));
});

const spot = (id: string, char: string): HaloPlacement => ({
    id,
    char,
    inlineStart: '0px',
    blockStart: '0px',
    tilt: 0,
    scale: 1,
    phase: 0,
    enterX: 0,
    enterY: 0,
    enterTwist: 0,
});

const letters = [spot('pool-w-2', 'o'), spot('pool-w-5', 'e')];

type Props = {
    placed: Set<string>;
    placements: Map<string, number>;
    loose: Set<string>;
};

const setup = (initial: Props) =>
    renderHook(({ placed, placements, loose }: Props) =>
        useLetterFlights({ placed, placements, letters, loose, reduced: false }), {
        initialProps: initial,
    });

describe('useLetterFlights — the homeward leg', () => {
    const placements = new Map([['pool-w-2', 2]]);

    /**
     * The bug, exactly as it was reported: tap a letter, watch it go in, then
     * watch something come straight back out.
     *
     * A settled letter leaves the pool for good, and from `placed` alone that
     * looks identical to a backspace — the id simply stops being in a slot. The
     * hook read it as the latter and flew the letter home, so every tap landed
     * and then undid itself on screen.
     */
    it('does not fly a settled letter back out of its slot', () => {
        const { result, rerender } = setup({
            placed: new Set(['pool-w-2']),
            placements,
            loose: new Set(['pool-w-2', 'pool-w-5']),
        });

        // The commit: the letter is written, so it leaves both the slot binding
        // and the pool in the same pass.
        rerender({
            placed: new Set(),
            placements: new Map(),
            loose: new Set(['pool-w-5']),
        });

        expect(result.current.flights.filter((f) => f.homeward)).toHaveLength(0);
    });

    it('still flies a letter home when the player takes it back', () => {
        const { result, rerender } = setup({
            placed: new Set(['pool-w-2']),
            placements,
            loose: new Set(['pool-w-2', 'pool-w-5']),
        });

        // A backspace: out of the slot, but back in the pool where it started.
        rerender({
            placed: new Set(),
            placements: new Map(),
            loose: new Set(['pool-w-2', 'pool-w-5']),
        });

        const homeward = result.current.flights.filter((f) => f.homeward);
        expect(homeward).toHaveLength(1);
        expect(homeward[0].poolId).toBe('pool-w-2');
    });

    it('still flies a letter into its slot on the way in', () => {
        const { result, rerender } = setup({
            placed: new Set(),
            placements: new Map(),
            loose: new Set(['pool-w-2', 'pool-w-5']),
        });

        rerender({
            placed: new Set(['pool-w-2']),
            placements,
            loose: new Set(['pool-w-2', 'pool-w-5']),
        });

        const inward = result.current.flights.filter((f) => !f.homeward);
        expect(inward).toHaveLength(1);
        expect(inward[0].char).toBe('o');
    });
});
