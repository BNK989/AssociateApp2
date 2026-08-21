import type { User } from '@supabase/supabase-js';
import type { GameState, Player } from '@/hooks/useGameLogic';
import { BOT_PROFILE, BOT_USER_ID, LOCAL_USER_ID, MY_PROFILE } from '@/lib/daily/dailyMessages';

/**
 * A stand-in user for the daily game, which is single-player and needs no real
 * identity — the shared game components all expect one.
 */
export const MOCK_USER: User = {
    id: LOCAL_USER_ID,
    email: 'guest@daily.game',
    user_metadata: { full_name: 'Guest Player', avatar_url: '' },
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
};

/**
 * The daily game rendered as if it were a classic game, so ChatArea, GameHeader
 * and GameInput can be reused unchanged.
 *
 * It is permanently in `solving`: the player only ever guesses backwards along
 * a chain that is already written.
 */
export function buildDailyGameState(wordCount: number, consecutive: number, gameOver: boolean): GameState {
    return {
        id: 'daily-game',
        handle: 1,
        status: gameOver ? 'completed' : 'solving',
        mode: 'free',
        current_turn_user_id: LOCAL_USER_ID,
        team_pot: 0,
        team_consecutive_correct: consecutive,
        fever_mode_remaining: 0,
        solve_proposal_confirmations: [],
        max_messages: wordCount,
    };
}

/** The player and the bot that authored the chain. */
export function buildDailyPlayers(score: number, consecutive: number): Player[] {
    const joined = new Date().toISOString();

    return [
        {
            user_id: LOCAL_USER_ID,
            score,
            joined_at: joined,
            consecutive_correct_guesses: consecutive,
            profiles: MY_PROFILE,
        },
        {
            user_id: BOT_USER_ID,
            score: 0,
            joined_at: joined,
            consecutive_correct_guesses: 0,
            profiles: BOT_PROFILE,
        },
    ];
}
