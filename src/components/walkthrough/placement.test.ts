import { describe, expect, it } from 'vitest';
import { GAP, MARGIN, placePopover, type Box, type Viewport } from './placement';

const viewport: Viewport = { width: 400, height: 800 };
const popover: Box = { top: 0, left: 0, width: 320, height: 180 };

/** A comfortable target in the middle of the screen. */
const middle: Box = { top: 300, left: 150, width: 100, height: 40 };

describe('placePopover', () => {
    it('centres when there is nothing to anchor to', () => {
        const placed = placePopover({ target: null, popover, viewport, preferred: 'bottom' });

        expect(placed).toEqual({ side: 'center', top: 310, left: 40, arrowLeft: null });
    });

    it('centres when the opening step asks for it, target or no target', () => {
        expect(placePopover({ target: middle, popover, viewport, preferred: 'center' }).side).toBe('center');
    });

    it('sits below its target, gap included', () => {
        const placed = placePopover({ target: middle, popover, viewport, preferred: 'bottom' });

        expect(placed.side).toBe('bottom');
        expect(placed.top).toBe(middle.top + middle.height + GAP);
    });

    it('measures the card rather than guessing its height when placing it above', () => {
        const short = placePopover({ target: middle, popover: { ...popover, height: 120 }, viewport, preferred: 'top' });
        const tall = placePopover({ target: middle, popover: { ...popover, height: 260 }, viewport, preferred: 'top' });

        // Both end a gap above the target, whatever they measure.
        expect(short.top + 120).toBe(middle.top - GAP);
        expect(tall.top + 260).toBe(middle.top - GAP);
    });

    it('flips to the other side rather than running off the screen', () => {
        const nearTop: Box = { top: 20, left: 150, width: 100, height: 40 };
        expect(placePopover({ target: nearTop, popover, viewport, preferred: 'top' }).side).toBe('bottom');

        const nearBottom: Box = { top: 700, left: 150, width: 100, height: 40 };
        expect(placePopover({ target: nearBottom, popover, viewport, preferred: 'bottom' }).side).toBe('top');
    });

    it('centres when neither side has room -- a short viewport with the keyboard up', () => {
        const squeezed: Viewport = { width: 400, height: 320 };
        const target: Box = { top: 120, left: 150, width: 100, height: 40 };

        expect(placePopover({ target, popover, viewport: squeezed, preferred: 'bottom' }).side).toBe('center');
    });

    it('keeps the card on screen when its target hugs an edge', () => {
        const atStart: Box = { top: 300, left: 0, width: 48, height: 40 };
        const atEnd: Box = { top: 300, left: 352, width: 48, height: 40 };

        expect(placePopover({ target: atStart, popover, viewport, preferred: 'bottom' }).left).toBe(MARGIN);
        expect(placePopover({ target: atEnd, popover, viewport, preferred: 'bottom' }).left)
            .toBe(viewport.width - popover.width - MARGIN);
    });

    /**
     * The whole reason the arrow is computed rather than pinned to 50%: a card
     * pushed sideways by the clamp used to keep pointing at its own middle,
     * which by then was somewhere else entirely.
     */
    it('points the arrow at the target, not at the middle of the card', () => {
        const atStart: Box = { top: 300, left: 0, width: 100, height: 40 };
        const placed = placePopover({ target: atStart, popover, viewport, preferred: 'bottom' });

        // Target centre is x=50; the card was clamped to MARGIN.
        expect(placed.left).toBe(MARGIN);
        expect(placed.arrowLeft).toBe(50 - MARGIN);
        expect(placed.arrowLeft).not.toBe(popover.width / 2);
    });

    it('keeps the arrow off the card corners', () => {
        const farEnd: Box = { top: 300, left: 396, width: 4, height: 40 };
        const placed = placePopover({ target: farEnd, popover, viewport, preferred: 'bottom' });

        expect(placed.arrowLeft).toBeLessThanOrEqual(popover.width - 20);
        expect(placed.arrowLeft).toBeGreaterThanOrEqual(20);
    });

    it('never reports a negative offset for a card wider than the screen', () => {
        const narrow: Viewport = { width: 280, height: 800 };
        const placed = placePopover({ target: middle, popover, viewport: narrow, preferred: 'bottom' });

        expect(placed.left).toBe(MARGIN);
    });
});
