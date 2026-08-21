/**
 * A game as the lobby and its cards render it: the row plus the counts and
 * player summaries the lobby query joins in.
 */
export type LobbyGame = {
    id: string;
    handle: number;
    status: string;
    mode: string;
    created_at: string;
    last_activity_at?: string;
    max_messages: number;
    message_count: number;
    current_turn_user_id?: string;
    players?: LobbyPlayerSummary[];
    team_pot?: number;
    team_consecutive_correct?: number;
    fever_mode_remaining?: number;
};

export type LobbyPlayerSummary = {
    has_left: boolean;
    is_archived?: boolean;
    user: {
        username: string;
        avatar_url: string;
    };
};

/**
 * The raw shape Supabase returns for the lobby query. `messages(count)` comes
 * back as a one-element array, and `game_players` is joined twice — once
 * filtered to the current user for membership flags, once unfiltered as
 * `players` for the avatar row.
 */
export type LobbyGameRow = Omit<LobbyGame, 'message_count' | 'players'> & {
    messages?: { count: number }[];
    game_players?: {
        user_id: string;
        is_archived?: boolean | null;
        has_left?: boolean | null;
    }[];
    players?: LobbyPlayerSummary[];
};
