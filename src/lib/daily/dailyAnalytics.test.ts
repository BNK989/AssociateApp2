import { describe, expect, it } from 'vitest';
import { dailyEvent, wordContext, type DailyContext } from './dailyAnalytics';
import { dailyPuzzleNumber } from './dailyShare';

const context: DailyContext = {
    play_date: '2026-01-04',
    user_type: 'guest',
    settings_revision: 7,
    words_total: 8,
};

describe('dailyEvent', () => {
    it('stamps the shared context onto every event', () => {
        const event = dailyEvent(context, 'daily_chain_revealed', {
            outcome_tier: 'partial',
            words_solved: 3,
        });

        expect(event.name).toBe('daily_chain_revealed');
        expect(event.properties).toMatchObject({
            play_date: '2026-01-04',
            user_type: 'guest',
            settings_revision: 7,
            words_total: 8,
            outcome_tier: 'partial',
            words_solved: 3,
        });
    });

    it('derives the puzzle number players actually see', () => {
        const event = dailyEvent(context, 'daily_game_entered', {});
        expect(event.properties.puzzle_number).toBe(dailyPuzzleNumber('2026-01-04'));
    });

    it('keeps the legacy `date` property so existing insights still filter', () => {
        const event = dailyEvent(context, 'daily_game_entered', {});
        expect(event.properties.date).toBe('2026-01-04');
    });

    // Two events that describe the same word have to describe it the same way,
    // or no dashboard can join a miss to the solve that followed it.
    it('describes a word identically across two different events', () => {
        const word = { hint_level: 2, strikes: 1, park_count: 1 };
        const shared = wordContext(word, 4, 9_000);

        const missed = dailyEvent(context, 'daily_guess_missed', {
            ...shared, band: 'near', similarity: 0.7, strike_forgiven: true,
        });
        const solved = dailyEvent(context, 'daily_word_solved', {
            ...shared,
            word: 'anchor',
            score_gained: 12,
            total_score: 40,
            consecutive: 1,
            solved_after_park: true,
        });

        for (const key of ['word_index', 'hint_level', 'strikes', 'park_count', 'ms_on_word']) {
            expect(missed.properties[key]).toEqual(solved.properties[key]);
        }
    });
});

describe('wordContext', () => {
    it('reports zero rather than undefined for a word missing a field', () => {
        expect(wordContext({}, 0, 0)).toEqual({
            word_index: 0,
            hint_level: 0,
            strikes: 0,
            park_count: 0,
            ms_on_word: 0,
        });
    });

    it('rounds the elapsed time, since PostHog gains nothing from fractions', () => {
        expect(wordContext({}, 1, 1234.7).ms_on_word).toBe(1235);
    });
});
