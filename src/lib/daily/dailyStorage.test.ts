import { describe, expect, it } from 'vitest';
import { shouldDiscardForRevision } from './dailyStorage';

describe('shouldDiscardForRevision', () => {
    it('keeps a game in progress by default, even when the policy changed', () => {
        expect(shouldDiscardForRevision(1, 2, 'keep')).toBe(false);
    });

    // The trap the PostHog flag has always had: a game master changes a setting,
    // nothing happens to anyone already playing, and it looks like the change
    // did not take.
    it('discards a game started under a different revision when asked to restart', () => {
        expect(shouldDiscardForRevision(1, 2, 'restart')).toBe(true);
    });

    it('keeps a game that is already on the current revision', () => {
        expect(shouldDiscardForRevision(2, 2, 'restart')).toBe(false);
    });

    // A save from before revisions were recorded is an ordinary game in
    // progress, not evidence that anything changed.
    it('keeps a save that predates revision stamping', () => {
        expect(shouldDiscardForRevision(undefined, 2, 'restart')).toBe(false);
        expect(shouldDiscardForRevision(undefined, 2, 'keep')).toBe(false);
    });

    // Revision 0 means "played against the compiled defaults" and is a real
    // value, distinct from an absent one.
    it('treats the no-revision marker as a real revision', () => {
        expect(shouldDiscardForRevision(0, 1, 'restart')).toBe(true);
        expect(shouldDiscardForRevision(0, 0, 'restart')).toBe(false);
    });

    it('discards when the revision went backwards, as a rollback does', () => {
        expect(shouldDiscardForRevision(5, 4, 'restart')).toBe(true);
    });
});
