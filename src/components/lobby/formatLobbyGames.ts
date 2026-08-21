import type { LobbyGame, LobbyGameRow } from './types';

export type SplitLobbyGames = {
    active: LobbyGame[];
    completed: LobbyGame[];
};

/**
 * Normalises the lobby query rows and splits them into the two sections.
 *
 * Two details the raw response makes awkward:
 * - `messages(count)` arrives as `[{ count: n }]` rather than a number, and is
 *   absent entirely for a game with no messages yet.
 * - `game_players` is joined filtered to the current user, so its single row
 *   carries *this* player's membership flags. A game they archived or left is
 *   dropped from the lobby without affecting anyone else's view.
 */
export function formatLobbyGames(rows: LobbyGameRow[], userId: string): SplitLobbyGames {
    const active: LobbyGame[] = [];
    const completed: LobbyGame[] = [];

    for (const row of rows) {
        const membership = row.game_players?.find((p) => p.user_id === userId);
        if (membership?.is_archived || membership?.has_left) continue;

        const game: LobbyGame = {
            ...row,
            message_count: row.messages?.[0]?.count ?? 0,
            players: row.players ?? [],
        };

        if (row.status === 'completed') {
            completed.push(game);
        } else {
            active.push(game);
        }
    }

    return { active, completed };
}

/** Players still in the game, i.e. excluding anyone who left. */
export function countActivePlayers(game: LobbyGame): number {
    return (game.players ?? []).filter((p) => !p.has_left).length;
}
