import { describe, it, expect } from 'vitest';
import { countActivePlayers, formatLobbyGames } from './formatLobbyGames';
import type { LobbyGameRow } from './types';

const ME = 'user-me';
const THEM = 'user-them';

function makeRow(overrides: Partial<LobbyGameRow> = {}): LobbyGameRow {
    return {
        id: 'game-1',
        handle: 1,
        status: 'texting',
        mode: 'free',
        created_at: '2026-08-21T09:00:00.000Z',
        max_messages: 25,
        messages: [{ count: 7 }],
        game_players: [{ user_id: ME, is_archived: false, has_left: false }],
        players: [],
        ...overrides,
    };
}

describe('formatLobbyGames — splitting', () => {
    it('puts completed games in their own bucket', () => {
        const { active, completed } = formatLobbyGames(
            [makeRow({ id: 'a' }), makeRow({ id: 'b', status: 'completed' })],
            ME,
        );

        expect(active.map((g) => g.id)).toEqual(['a']);
        expect(completed.map((g) => g.id)).toEqual(['b']);
    });

    it('treats every non-completed status as active', () => {
        const rows = ['texting', 'solving', 'lobby', 'active'].map((status, i) =>
            makeRow({ id: `g${i}`, status }),
        );
        expect(formatLobbyGames(rows, ME).active).toHaveLength(4);
    });

    it('returns empty buckets for no rows', () => {
        expect(formatLobbyGames([], ME)).toEqual({ active: [], completed: [] });
    });
});

describe('formatLobbyGames — membership filtering', () => {
    it('hides a game the player archived', () => {
        const row = makeRow({ game_players: [{ user_id: ME, is_archived: true, has_left: false }] });
        expect(formatLobbyGames([row], ME).active).toHaveLength(0);
    });

    it('hides a game the player left', () => {
        const row = makeRow({ game_players: [{ user_id: ME, is_archived: false, has_left: true }] });
        expect(formatLobbyGames([row], ME).active).toHaveLength(0);
    });

    it('hides an archived completed game too', () => {
        const row = makeRow({ status: 'completed', game_players: [{ user_id: ME, is_archived: true }] });
        expect(formatLobbyGames([row], ME).completed).toHaveLength(0);
    });

    it('ignores another player archive or leave state', () => {
        const row = makeRow({
            game_players: [
                { user_id: THEM, is_archived: true, has_left: true },
                { user_id: ME, is_archived: false, has_left: false },
            ],
        });
        expect(formatLobbyGames([row], ME).active).toHaveLength(1);
    });

    it('keeps a game when membership flags are missing', () => {
        // Older rows predate these columns and come back as null.
        const row = makeRow({ game_players: [{ user_id: ME, is_archived: null, has_left: null }] });
        expect(formatLobbyGames([row], ME).active).toHaveLength(1);
    });

    it('keeps a game when the membership row is absent entirely', () => {
        expect(formatLobbyGames([makeRow({ game_players: [] })], ME).active).toHaveLength(1);
        expect(formatLobbyGames([makeRow({ game_players: undefined })], ME).active).toHaveLength(1);
    });
});

describe('formatLobbyGames — message count', () => {
    it('unwraps the aggregate array', () => {
        expect(formatLobbyGames([makeRow({ messages: [{ count: 42 }] })], ME).active[0].message_count).toBe(42);
    });

    it('falls back to zero when the aggregate is missing or empty', () => {
        expect(formatLobbyGames([makeRow({ messages: undefined })], ME).active[0].message_count).toBe(0);
        expect(formatLobbyGames([makeRow({ messages: [] })], ME).active[0].message_count).toBe(0);
    });

    it('keeps an explicit zero rather than treating it as missing', () => {
        expect(formatLobbyGames([makeRow({ messages: [{ count: 0 }] })], ME).active[0].message_count).toBe(0);
    });

    it('defaults players to an array when the join returns nothing', () => {
        expect(formatLobbyGames([makeRow({ players: undefined })], ME).active[0].players).toEqual([]);
    });
});

describe('countActivePlayers', () => {
    const player = (has_left: boolean) => ({
        has_left,
        user: { username: 'p', avatar_url: '' },
    });

    it('excludes players who left', () => {
        const game = formatLobbyGames(
            [makeRow({ players: [player(false), player(true), player(false)] })],
            ME,
        ).active[0];

        expect(countActivePlayers(game)).toBe(2);
    });

    it('handles an empty roster', () => {
        expect(countActivePlayers(formatLobbyGames([makeRow()], ME).active[0])).toBe(0);
    });
});
