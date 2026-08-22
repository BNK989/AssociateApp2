import { describe, it, expect } from 'vitest';
import {
    buildResultPayload,
    clampWordMs,
    countStreak,
    MAX_WORD_MS,
    parseResultPayload,
    type WordResult,
} from './dailyResults';

const CLIENT_ID = 'c0ffee00-dead-beef-1234-567890abcdef';
const PLAY_DATE = '2026-08-22';

function word(overrides: Partial<WordResult> = {}): WordResult {
    return {
        index: 0,
        outcome: 'solved',
        hint_level: 0,
        strikes: 0,
        points: 100,
        ms: 5_000,
        ...overrides,
    };
}

describe('clampWordMs', () => {
    it('passes a believable duration through untouched', () => {
        expect(clampWordMs(12_345)).toBe(12_345);
    });

    it('caps a walked-away session at the ceiling', () => {
        expect(clampWordMs(MAX_WORD_MS + 60_000)).toBe(MAX_WORD_MS);
    });

    it('treats negative and non-finite values as no time at all', () => {
        expect(clampWordMs(-1)).toBe(0);
        expect(clampWordMs(Number.NaN)).toBe(0);
        expect(clampWordMs(Number.POSITIVE_INFINITY)).toBe(0);
    });
});

describe('buildResultPayload', () => {
    const perWord: WordResult[] = [
        word({ index: 0, outcome: 'solved', hint_level: 1, strikes: 1, points: 80, ms: 4_000 }),
        word({ index: 1, outcome: 'struck_out', hint_level: 3, strikes: 3, points: 0, ms: 9_000 }),
        word({ index: 2, outcome: 'gave_up', hint_level: 2, strikes: 0, points: 0, ms: 2_000 }),
    ];

    const payload = buildResultPayload({
        clientId: CLIENT_ID,
        playDate: PLAY_DATE,
        wordsTotal: 6,
        score: 80,
        perWord,
        completed: false,
        settingsRevision: 7,
    });

    it('counts only solved words as solved', () => {
        expect(payload.words_solved).toBe(1);
    });

    it('derives the totals from the per-word log rather than tracking them apart', () => {
        expect(payload.hints_used).toBe(6);
        expect(payload.strikes).toBe(4);
        expect(payload.duration_ms).toBe(15_000);
    });

    it('records how far the player got, which is short of the full chain', () => {
        expect(payload.per_word).toHaveLength(3);
        expect(payload.words_total).toBe(6);
        expect(payload.completed).toBe(false);
    });

    it('caps a walked-away word before it reaches the duration total', () => {
        const capped = buildResultPayload({
            clientId: CLIENT_ID,
            playDate: PLAY_DATE,
            wordsTotal: 2,
            score: 0,
            perWord: [word({ ms: MAX_WORD_MS * 5 })],
            completed: false,
            settingsRevision: 7,
        });

        expect(capped.duration_ms).toBe(MAX_WORD_MS);
        expect(capped.per_word[0].ms).toBe(MAX_WORD_MS);
    });

    it('produces an empty log for a player who never resolved a word', () => {
        const abandoned = buildResultPayload({
            clientId: CLIENT_ID,
            playDate: PLAY_DATE,
            wordsTotal: 8,
            score: 0,
            perWord: [],
            completed: false,
            settingsRevision: 7,
        });

        expect(abandoned.per_word).toEqual([]);
        expect(abandoned.duration_ms).toBe(0);
        expect(abandoned.words_solved).toBe(0);
    });
});

describe('parseResultPayload', () => {
    const validBody = {
        client_id: CLIENT_ID,
        play_date: PLAY_DATE,
        score: 250,
        completed: true,
        per_word: [word({ index: 0 }), word({ index: 1 })],
    };

    it('accepts a well-formed body', () => {
        const result = parseResultPayload(validBody, 2);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.payload.score).toBe(250);
        expect(result.payload.words_solved).toBe(2);
    });

    it('takes the chain length from the server, not from the request', () => {
        const result = parseResultPayload({ ...validBody, words_total: 99 }, 2);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.payload.words_total).toBe(2);
    });

    it('rejects a log longer than the chain that was served', () => {
        const result = parseResultPayload(validBody, 1);

        expect(result.ok).toBe(false);
    });

    it('rejects a per-word index past the end of the chain', () => {
        const result = parseResultPayload(
            { ...validBody, per_word: [word({ index: 7 })] },
            2,
        );

        expect(result.ok).toBe(false);
    });

    it('rejects an unknown outcome', () => {
        const result = parseResultPayload(
            { ...validBody, per_word: [{ ...word(), outcome: 'teleported' }] },
            2,
        );

        expect(result.ok).toBe(false);
    });

    it('rejects out-of-range hint levels and strikes', () => {
        expect(parseResultPayload({ ...validBody, per_word: [word({ hint_level: 9 })] }, 2).ok).toBe(false);
        expect(parseResultPayload({ ...validBody, per_word: [word({ strikes: 50 })] }, 2).ok).toBe(false);
    });

    it('rejects a negative or absurd score', () => {
        expect(parseResultPayload({ ...validBody, score: -5 }, 2).ok).toBe(false);
        expect(parseResultPayload({ ...validBody, score: 1e12 }, 2).ok).toBe(false);
    });

    it('rejects a malformed play_date', () => {
        expect(parseResultPayload({ ...validBody, play_date: '22/08/2026' }, 2).ok).toBe(false);
    });

    it('rejects a missing or stub client_id', () => {
        expect(parseResultPayload({ ...validBody, client_id: 'x' }, 2).ok).toBe(false);
        expect(parseResultPayload({ ...validBody, client_id: 42 }, 2).ok).toBe(false);
    });

    it('rejects a non-object body', () => {
        expect(parseResultPayload(null, 2).ok).toBe(false);
        expect(parseResultPayload('nope', 2).ok).toBe(false);
    });

    it('clamps an inflated duration rather than trusting it', () => {
        const result = parseResultPayload(
            { ...validBody, per_word: [word({ index: 0, ms: MAX_WORD_MS })] },
            2,
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.payload.duration_ms).toBe(MAX_WORD_MS);
    });
});

describe('countStreak', () => {
    it('counts an unbroken run ending today', () => {
        expect(countStreak(['2026-08-22', '2026-08-21', '2026-08-20'], '2026-08-22')).toBe(3);
    });

    it('is one for a single day', () => {
        expect(countStreak(['2026-08-22'], '2026-08-22')).toBe(1);
    });

    it('is zero when today is not finished, however long the past run', () => {
        // The streak is about continuing it, so an unfinished today ends it.
        expect(countStreak(['2026-08-21', '2026-08-20'], '2026-08-22')).toBe(0);
    });

    it('stops at the first gap rather than counting completions', () => {
        // Finished Monday and Wednesday: Wednesday is a streak of one, not two.
        expect(countStreak(['2026-08-19', '2026-08-17'], '2026-08-19')).toBe(1);
    });

    it('walks across a month boundary', () => {
        expect(countStreak(['2026-09-01', '2026-08-31', '2026-08-30'], '2026-09-01')).toBe(3);
    });

    it('walks across a year boundary', () => {
        expect(countStreak(['2027-01-01', '2026-12-31', '2026-12-30'], '2027-01-01')).toBe(3);
    });

    it('ignores days after the one being counted from', () => {
        expect(countStreak(['2026-08-25', '2026-08-22', '2026-08-21'], '2026-08-22')).toBe(2);
    });

    it('is zero with no history at all', () => {
        expect(countStreak([], '2026-08-22')).toBe(0);
    });
});

describe('parseResultPayload — settings_revision', () => {
    const base = {
        client_id: CLIENT_ID,
        play_date: PLAY_DATE,
        score: 0,
        completed: false,
        per_word: [],
    };

    it('reads a stored revision', () => {
        const parsed = parseResultPayload({ ...base, settings_revision: 12 }, 5);
        expect(parsed.ok && parsed.payload.settings_revision).toBe(12);
    });

    // A client that could not read the settings still played a real game.
    // Rejecting it would bias exactly the drop-off numbers this table exists for.
    it('records an absent revision as the no-revision marker', () => {
        for (const value of [undefined, null]) {
            const parsed = parseResultPayload({ ...base, settings_revision: value }, 5);
            expect(parsed.ok && parsed.payload.settings_revision).toBe(0);
        }
    });

    it('rejects a revision outside any believable range', () => {
        const parsed = parseResultPayload({ ...base, settings_revision: -1 }, 5);
        expect(parsed.ok).toBe(false);
    });

    it('rejects a non-numeric revision', () => {
        const parsed = parseResultPayload({ ...base, settings_revision: 'latest' }, 5);
        expect(parsed.ok).toBe(false);
    });
});
