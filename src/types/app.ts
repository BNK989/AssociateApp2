/**
 * Application-level types derived from the generated Supabase schema.
 *
 * Prefer these over hand-written DB shapes (CLAUDE.md §1). If a column changes,
 * regenerate `database.types.ts` and the errors surface here.
 *
 * Note: `Message`, `GameState` and `Player` in `@/hooks/useGameLogic` are the
 * *app-facing* shapes (joined, narrowed, with client-only fields). The `*Row`
 * aliases below are the raw table rows. They are not interchangeable.
 */

import type { Tables } from './database.types';

export type ProfileRow = Tables<'profiles'>;
export type GameRow = Tables<'games'>;
export type GamePlayerRow = Tables<'game_players'>;
export type MessageRow = Tables<'messages'>;
export type InviteRow = Tables<'invites'>;
export type DailyGameRow = Tables<'daily_games'>;

/**
 * User-controlled preferences stored in `profiles.settings` (jsonb).
 * Every field is optional — older rows predate most of these keys.
 */
export interface ProfileSettings {
    theme?: string;
    language?: string;
    audio_volume?: number;
    enable_system_notifications?: boolean;
    enable_audio_chime?: boolean;
    enable_title_flash?: boolean;
    enable_debug_mode?: boolean;
    auto_hint_enabled?: boolean;
    auto_hint_duration?: number;
    daily_tutorial_seen?: boolean;
}

/**
 * A profile as the app consumes it: the generated row with `settings` narrowed
 * from `Json` to the known preference keys.
 */
export type Profile = Omit<ProfileRow, 'settings'> & {
    settings: ProfileSettings | null;
};
