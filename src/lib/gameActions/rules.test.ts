import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from '@/lib/gameConfig';
import {
    allActivePlayersConfirmed,
    applyStrike,
    FEVER_DURATION,
    FEVER_TRIGGER_STREAK,
    isFreeForAll,
    nextTeamStats,
    resetTeamStats,
} from './rules';

const WINDOW_MS = (GAME_CONFIG.SOLVING_MODE_DURATION_SECONDS || 20) * 1000;
const NOW = Date.parse('2026-08-21T12:00:00.000Z');

const startedAgo = (ms: number) => new Date(NOW - ms).toISOString();

describe('isFreeForAll', () => {
    it('keeps the turn with the author inside the window', () => {
        expect(isFreeForAll(startedAgo(WINDOW_MS - 1000), NOW)).toBe(false);
    });

    it('opens the turn once the window has elapsed', () => {
        expect(isFreeForAll(startedAgo(WINDOW_MS + 1000), NOW)).toBe(true);
    });

    it('is not free-for-all exactly at the boundary', () => {
        expect(isFreeForAll(startedAgo(WINDOW_MS), NOW)).toBe(false);
    });

    it('treats a missing start time as free-for-all', () => {
        // Without a timestamp the timer cannot be trusted, so nobody is locked out.
        expect(isFreeForAll(null, NOW)).toBe(true);
        expect(isFreeForAll(undefined, NOW)).toBe(true);
    });
});

describe('allActivePlayersConfirmed', () => {
    it('is true when every active player has confirmed', () => {
        expect(allActivePlayersConfirmed(['a', 'b'], ['a', 'b'])).toBe(true);
    });

    it('ignores confirmations from players who have left', () => {
        expect(allActivePlayersConfirmed(['a'], ['a', 'gone'])).toBe(true);
    });

    it('is false while anyone active is missing', () => {
        expect(allActivePlayersConfirmed(['a', 'b'], ['a'])).toBe(false);
    });

    it('is false for an empty roster', () => {
        // Otherwise a game with nobody in it could flip itself into solving.
        expect(allActivePlayersConfirmed([], [])).toBe(false);
        expect(allActivePlayersConfirmed([], ['a'])).toBe(false);
    });

    it('handles a solo game confirming itself', () => {
        expect(allActivePlayersConfirmed(['solo'], ['solo'])).toBe(true);
    });
});

describe('nextTeamStats', () => {
    it('extends the streak from nothing', () => {
        expect(nextTeamStats(null)).toEqual({
            team_consecutive_correct: 1,
            fever_mode_remaining: 0,
        });
    });

    it('burns one fever solve per correct answer', () => {
        expect(nextTeamStats({ team_consecutive_correct: 1, fever_mode_remaining: 3 }))
            .toEqual({ team_consecutive_correct: 2, fever_mode_remaining: 2 });
    });

    it('triggers fever on reaching the streak threshold', () => {
        const result = nextTeamStats({
            team_consecutive_correct: FEVER_TRIGGER_STREAK - 1,
            fever_mode_remaining: 0,
        });
        expect(result).toEqual({
            team_consecutive_correct: FEVER_TRIGGER_STREAK,
            fever_mode_remaining: FEVER_DURATION,
        });
    });

    it('does not re-trigger fever while a run is still burning', () => {
        const result = nextTeamStats({
            team_consecutive_correct: FEVER_TRIGGER_STREAK,
            fever_mode_remaining: 2,
        });
        expect(result.fever_mode_remaining).toBe(1);
    });

    it('re-triggers once a run has fully burned out', () => {
        // Streak is past the threshold and fever just hit zero, so it relights.
        const result = nextTeamStats({
            team_consecutive_correct: FEVER_TRIGGER_STREAK + 2,
            fever_mode_remaining: 1,
        });
        expect(result.fever_mode_remaining).toBe(FEVER_DURATION);
    });

    it('never drives fever negative', () => {
        expect(nextTeamStats({ team_consecutive_correct: 1, fever_mode_remaining: 0 }).fever_mode_remaining).toBe(0);
    });
});

describe('resetTeamStats', () => {
    it('clears both counters', () => {
        expect(resetTeamStats()).toEqual({
            team_consecutive_correct: 0,
            fever_mode_remaining: 0,
        });
    });
});

describe('applyStrike', () => {
    it('counts up from nothing', () => {
        expect(applyStrike(null)).toEqual({ strikes: 1, isOutOfPlay: false });
        expect(applyStrike(undefined)).toEqual({ strikes: 1, isOutOfPlay: false });
    });

    it('retires the message on the third strike', () => {
        expect(applyStrike(1)).toEqual({ strikes: 2, isOutOfPlay: false });
        expect(applyStrike(2)).toEqual({ strikes: 3, isOutOfPlay: true });
    });
});
