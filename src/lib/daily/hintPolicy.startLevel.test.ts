import { describe, expect, it } from 'vitest';
import { MAX_HINT_LEVEL } from '@/lib/gameConfig';
import {
    DEFAULT_HINT_POLICY,
    openingHintLevel,
    START_LEVEL_REACHES,
    startLevelFor,
    type DailyHintPolicy,
} from './hintPolicy';

function policy(overrides: Partial<DailyHintPolicy> = {}): DailyHintPolicy {
    return {
        ...DEFAULT_HINT_POLICY,
        rungs: DEFAULT_HINT_POLICY.rungs.map((r) => ({ ...r })) as DailyHintPolicy['rungs'],
        ...overrides,
    };
}

/**
 * Which words open hinted, and when the level lands on them.
 *
 * Split out of `hintPolicy.test.ts` when that file crossed the line cap. The
 * two functions here are a pair — `startLevelFor` says who is entitled to the
 * start level and `openingHintLevel` says which of them show it before the
 * player arrives — so they are tested together and against each other.
 */

describe('startLevelFor', () => {
    const TOTAL = 6; // indices 0..5; 5 is the freebie, 4 is the first word played

    it('gives nothing away when the start level is zero', () => {
        const p = policy({ startLevel: 0, startLevelAppliesTo: 'every-word' });
        for (let i = 0; i < TOTAL; i += 1) {
            expect(startLevelFor(p, i, TOTAL)).toBe(0);
        }
    });

    it('under first-word, only the word immediately before the freebie starts hinted', () => {
        const p = policy({ startLevel: 1, startLevelAppliesTo: 'first-word' });

        expect(startLevelFor(p, 4, TOTAL)).toBe(1);
        expect(startLevelFor(p, 3, TOTAL)).toBe(0);
        expect(startLevelFor(p, 0, TOTAL)).toBe(0);
    });

    it('under every-word, the whole chain starts hinted', () => {
        const p = policy({ startLevel: 1, startLevelAppliesTo: 'every-word' });

        for (let i = 0; i <= 4; i += 1) {
            expect(startLevelFor(p, i, TOTAL)).toBe(1);
        }
    });

    // On-arrival changes *when* the level lands, not who is entitled to it, and
    // scoring reads this function — so it has to match every-word exactly or the
    // two reaches would score the same play differently.
    it('under every-word-on-arrival, entitles the whole chain just like every-word', () => {
        const p = policy({ startLevel: 2, startLevelAppliesTo: 'every-word-on-arrival' });

        for (let i = 0; i <= 4; i += 1) {
            expect(startLevelFor(p, i, TOTAL)).toBe(2);
        }
    });

    // The last word is handed to the player already solved, so a hint level on
    // it would be both meaningless and visible.
    it('never hints the freebie word, under any reach', () => {
        for (const appliesTo of START_LEVEL_REACHES) {
            const p = policy({ startLevel: 3, startLevelAppliesTo: appliesTo });
            expect(startLevelFor(p, TOTAL - 1, TOTAL)).toBe(0);
        }
    });

    it('clamps a start level above the ladder', () => {
        const p = policy({ startLevel: 99, startLevelAppliesTo: 'every-word' });
        expect(startLevelFor(p, 0, TOTAL)).toBe(MAX_HINT_LEVEL);
    });

    it('clamps a negative start level', () => {
        const p = policy({ startLevel: -2, startLevelAppliesTo: 'every-word' });
        expect(startLevelFor(p, 0, TOTAL)).toBe(0);
    });

    it('handles a degenerate chain without going out of bounds', () => {
        const p = policy({ startLevel: 2, startLevelAppliesTo: 'every-word' });

        expect(startLevelFor(p, 0, 1)).toBe(0);
        expect(startLevelFor(p, 0, 0)).toBe(0);
        expect(startLevelFor(p, -1, TOTAL)).toBe(0);
    });
});

describe('openingHintLevel', () => {
    const TOTAL = 6;

    // The whole point of the on-arrival reach: the board must not give away
    // words the player has not reached yet.
    it('under every-word-on-arrival, opens only the first word played', () => {
        const p = policy({ startLevel: 2, startLevelAppliesTo: 'every-word-on-arrival' });

        expect(openingHintLevel(p, 4, TOTAL)).toBe(2);
        for (const i of [0, 1, 2, 3, 5]) {
            expect(openingHintLevel(p, i, TOTAL)).toBe(0);
        }
    });

    it('matches the entitled level under the two up-front reaches', () => {
        for (const appliesTo of ['first-word', 'every-word'] as const) {
            const p = policy({ startLevel: 2, startLevelAppliesTo: appliesTo });

            for (let i = 0; i < TOTAL; i += 1) {
                expect(openingHintLevel(p, i, TOTAL)).toBe(startLevelFor(p, i, TOTAL));
            }
        }
    });

    it('never exceeds the entitled level', () => {
        for (const appliesTo of START_LEVEL_REACHES) {
            const p = policy({ startLevel: 3, startLevelAppliesTo: appliesTo });

            for (let i = 0; i < TOTAL; i += 1) {
                expect(openingHintLevel(p, i, TOTAL)).toBeLessThanOrEqual(startLevelFor(p, i, TOTAL));
            }
        }
    });
});
