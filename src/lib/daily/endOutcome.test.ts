import { describe, expect, it } from 'vitest';
import { resolveChainOutcome } from './endOutcome';
import type { ShareSquare } from './dailyShare';

const squares = (spec: string): ShareSquare[] =>
    [...spec].map((c) => (c === 'c' ? 'clean' : c === 'h' ? 'hinted' : 'missed'));

describe('resolveChainOutcome', () => {
    it('calls a fully solved chain perfect', () => {
        expect(resolveChainOutcome(squares('cccc')).tier).toBe('perfect');
    });

    it('counts a hinted solve as solved', () => {
        const outcome = resolveChainOutcome(squares('chch'));
        expect(outcome.tier).toBe('perfect');
        expect(outcome.solved).toBe(4);
    });

    it('calls a mostly solved chain strong', () => {
        expect(resolveChainOutcome(squares('cccm')).tier).toBe('strong');
    });

    it('treats exactly the threshold as strong', () => {
        // 3 of 5 is 0.6.
        expect(resolveChainOutcome(squares('cccmm')).tier).toBe('strong');
    });

    it('calls a thin chain partial', () => {
        expect(resolveChainOutcome(squares('cmmmm')).tier).toBe('partial');
    });

    it('calls a chain with nothing solved blank', () => {
        expect(resolveChainOutcome(squares('mmmm')).tier).toBe('blank');
    });

    it('does not celebrate a result the player did not earn', () => {
        expect(resolveChainOutcome(squares('mmmm')).celebrate).toBe(false);
        expect(resolveChainOutcome(squares('cmmmm')).celebrate).toBe(false);
        expect(resolveChainOutcome(squares('cccm')).celebrate).toBe(true);
    });

    it('does not call an empty grid perfect', () => {
        const outcome = resolveChainOutcome([]);
        expect(outcome.tier).toBe('blank');
        expect(outcome.celebrate).toBe(false);
    });
});
