export type FloatingAnimationData = {
    type: 'steal';
    stealerName: string;
    stealerAvatar?: string;
    authorName?: string;
} | {
    type: 'announcement';
    message: string;
    subMessage?: string;
    icon?: string;
};

export type Message = {
    id: string;
    content: string;
    cipher_length: number;
    is_solved: boolean;
    user_id: string;
    created_at: string;
    strikes: number;
    hint_level: number;
    type?: 'text' | 'system';
    cipher_text?: string;
    ai_hint?: string;
    /** Strength of the link to the previous word, 0.0–1.0. */
    connection_score?: number;
    solved_by?: string;
    winner_points?: number;
    author_points?: number;
    game_id?: string;
    profiles?: {
        username: string;
        avatar_url: string;
    };
    guesses?: string[];
};

export type GameState = {
    id: string;
    /** Short human-friendly number shown in the UI. */
    handle: number;
    status: 'lobby' | 'texting' | 'active' | 'solving' | 'completed';
    mode: 'free' | '100_text';
    current_turn_user_id: string;
    solving_proposal_created_at?: string | null;
    solving_started_at?: string | null;
    team_pot: number;
    team_consecutive_correct: number;
    fever_mode_remaining: number;
    solve_proposal_confirmations: string[];
    max_messages?: number;
};

export type Player = {
    user_id: string;
    score: number;
    joined_at: string;
    consecutive_correct_guesses: number;
    has_left?: boolean;
    profiles?: {
        username: string;
        avatar_url: string;
    };
};
