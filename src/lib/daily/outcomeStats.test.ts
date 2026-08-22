import { describe, expect, it } from 'vitest';
import {
    median,
    summariseByRevision,
    wordsReached,
    type ResultRow,
} from './outcomeStats';

function row(overrides: Partial<ResultRow> = {}): ResultRow {
    return {
        settings_revision: 1,
        play_date: '2026-08-22',
        words_total: 5,
        words_solved: 4,
        score: 200,
        hints_used: 4,
        strikes: 1,
        duration_ms: 40_000,
        completed: false,
        per_word: [{}, {}, {}, {}],
        ...overrides,
    };
}

describe('median', () => {
    it('takes the middle of an odd count', () => {
        expect(median([5, 1, 3])).toBe(3);
    });

    it('averages the two middles of an even count', () => {
        expect(median([1, 2, 3, 4])).toBe(2.5);
    });

    it('is zero for nothing', () => {
        expect(median([])).toBe(0);
    });

    it('does not mutate its input', () => {
        const values = [3, 1, 2];
        median(values);
        expect(values).toEqual([3, 1, 2]);
    });
});

describe('wordsReached', () => {
    it('counts the per-word log', () => {
        expect(wordsReached(row({ per_word: [{}, {}] }))).toBe(2);
    });

    it('treats a malformed log as no progress', () => {
        expect(wordsReached(row({ per_word: null }))).toBe(0);
        expect(wordsReached(row({ per_word: 'nope' }))).toBe(0);
    });
});

describe('summariseByRevision', () => {
    it('groups plays by the configuration that produced them', () => {
        const stats = summariseByRevision([
            row({ settings_revision: 1 }),
            row({ settings_revision: 1 }),
            row({ settings_revision: 2 }),
        ]);

        expect(stats.map((s) => s.revision)).toEqual([2, 1]);
        expect(stats.find((s) => s.revision === 1)?.plays).toBe(2);
    });

    it('reports the completion rate as a share of plays', () => {
        const stats = summariseByRevision([
            row({ completed: true }),
            row({ completed: true }),
            row({ completed: false }),
            row({ completed: false }),
        ]);

        expect(stats[0].completionRate).toBe(0.5);
    });

    // Per word reached, not per play: a play that stopped at word two says
    // nothing about the hints on words three through five.
    it('averages hints against words reached rather than plays', () => {
        const stats = summariseByRevision([
            row({ hints_used: 6, per_word: [{}, {}, {}] }),
            row({ hints_used: 2, per_word: [{}] }),
        ]);

        expect(stats[0].hintsPerWord).toBe(2);
    });

    it('reports where players stop, not only what they solved', () => {
        const stats = summariseByRevision([
            row({ words_solved: 1, per_word: [{}, {}, {}] }),
            row({ words_solved: 3, per_word: [{}, {}, {}] }),
        ]);

        expect(stats[0].medianReached).toBe(3);
        expect(stats[0].medianSolved).toBe(2);
    });

    it('spans the dates a configuration was live for', () => {
        const stats = summariseByRevision([
            row({ play_date: '2026-08-20' }),
            row({ play_date: '2026-08-22' }),
            row({ play_date: '2026-08-21' }),
        ]);

        expect(stats[0].firstSeen).toBe('2026-08-20');
        expect(stats[0].lastSeen).toBe('2026-08-22');
    });

    // Revision 0 is a real answer -- "played against the compiled defaults" --
    // and must not be folded in with rows that predate the column.
    it('keeps the compiled-defaults revision separate from an absent one', () => {
        const stats = summariseByRevision([
            row({ settings_revision: 0 }),
            row({ settings_revision: null }),
        ]);

        expect(stats.map((s) => s.revision)).toEqual([0, null]);
    });

    it('sorts unattributed rows last without dropping them', () => {
        const stats = summariseByRevision([
            row({ settings_revision: null }),
            row({ settings_revision: 3 }),
            row({ settings_revision: 1 }),
        ]);

        expect(stats.map((s) => s.revision)).toEqual([3, 1, null]);
        expect(stats.reduce((sum, s) => sum + s.plays, 0)).toBe(3);
    });

    it('does not divide by zero for plays that reached no words', () => {
        const stats = summariseByRevision([row({ per_word: [], hints_used: 0, duration_ms: 0 })]);

        expect(stats[0].hintsPerWord).toBe(0);
        expect(stats[0].medianMsPerWord).toBe(0);
    });

    it('has nothing to say about no rows', () => {
        expect(summariseByRevision([])).toEqual([]);
    });
});
