import { describe, expect, it } from 'vitest';
import type { StuckOfferKind } from './stuckSignals';
import {
    COLLAPSE_AFTER_MS,
    TRANSIENT_HOLD_MS,
    holdMsFor,
    phaseAfterHold,
    presentationFor,
} from './offerPresentation';

const ACTIONABLE: StuckOfferKind[] = ['other_end', 'letter', 'reveal'];

describe('offerPresentation', () => {
    // The remark has nothing to do with it, so leaving it on screen is only
    // clutter: it has to take itself away.
    it('lets the remark fade out on its own', () => {
        expect(presentationFor('stake')).toBe('transient');
        expect(phaseAfterHold('stake')).toBe('gone');
    });

    // A route out must survive the moment it interrupted. A player thinking
    // hard when it lands is exactly the player who wants it afterwards.
    it.each(ACTIONABLE)('parks %s aside rather than closing it', (kind) => {
        expect(presentationFor(kind)).toBe('collapsing');
        expect(phaseAfterHold(kind)).toBe('collapsed');
    });

    it('holds a remark for less time than an offer it cannot take back', () => {
        expect(holdMsFor('stake')).toBe(TRANSIENT_HOLD_MS);
        expect(holdMsFor('other_end')).toBe(COLLAPSE_AFTER_MS);
        expect(TRANSIENT_HOLD_MS).toBeLessThan(COLLAPSE_AFTER_MS);
    });

    // Long enough to be read a beat late, since the player is mid-guess when it
    // lands rather than watching the slot it appears in.
    it('gives a remark longer than a glance', () => {
        expect(TRANSIENT_HOLD_MS).toBeGreaterThanOrEqual(4000);
    });
});
