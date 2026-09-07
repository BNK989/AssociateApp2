import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';
import {
    FALLBACK_DAILY_FEEDBACK_SETTINGS,
    FALLBACK_DAILY_HINT_SETTINGS,
    feedbackFromRow,
    isMissingTable,
    settingsFromRow,
    type DailyFeedbackSettings,
    type DailyHintSettings,
    type SettingsRow,
} from './settingsRow';

// Server-only: this reads the game_settings table on the server and is imported
// by server components and API routes. Never import it from a client component.

const log = createLogger('game-settings');

/** Cache tag revalidated whenever an admin saves, so edits land immediately. */
export const GAME_SETTINGS_TAG = 'game-settings';

export const DAILY_HINT_POLICY_KEY = 'daily_hint_policy';
export const DAILY_FEEDBACK_KEY = 'daily_feedback';

/** The migration that creates the table, named in the log when it is missing. */
const SETTINGS_MIGRATION = 'supabase/migrations/20260822140000_create_game_settings.sql';

/**
 * Ceiling on how long a stale policy may be served. The admin route revalidates
 * the tag on write, so this only bounds drift from a write that happened
 * somewhere else (a direct SQL edit, or another deployment).
 */
const REVALIDATE_SECONDS = 60;

export {
    FALLBACK_DAILY_FEEDBACK_SETTINGS,
    FALLBACK_DAILY_HINT_SETTINGS,
    NO_REVISION,
    type DailyFeedbackSettings,
    type DailyHintSettings,
} from './settingsRow';

/**
 * Reads with the anon key and no cookies.
 *
 * Two reasons, both load-bearing. The table's select policy is `using (true)`
 * because guests play the daily game and must get the same settings as anyone
 * else, so no session is needed. And a function wrapped in `unstable_cache`
 * must not read cookies — the result is shared across requests, so a
 * per-request client would be both wrong and a cache correctness bug.
 */
function anonClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
    );
}

/**
 * One settings row, or null with the reason logged.
 *
 * Never throws: every caller has a compiled fallback and a null here means
 * "play by that". The three ways this can come back empty are logged
 * differently on purpose — a missing table is a normal state during the window
 * between merging code and applying its migration, a missing row is a seeding
 * gap, and anything else is a real fault.
 */
async function readSettingsRow(key: string): Promise<SettingsRow | null> {
    const { data, error } = await anonClient()
        .from('game_settings')
        .select('value, scope, revision')
        .eq('key', key)
        .maybeSingle<SettingsRow>();

    if (error) {
        if (isMissingTable(error)) {
            log.warn(
                'read',
                'game_settings table does not exist; the daily game is running on the compiled defaults. '
                + `Apply ${SETTINGS_MIGRATION} to enable game-master controls`,
                { key },
            );
        } else {
            log.error(
                'read',
                'Failed to read a game setting; falling back to the compiled defaults',
                { key },
                error,
            );
        }
        return null;
    }

    if (!data) {
        log.warn('read', 'No row in game_settings for this key; falling back to the compiled defaults', { key });
        return null;
    }

    return data;
}

async function readDailyHintSettings(): Promise<DailyHintSettings> {
    const row = await readSettingsRow(DAILY_HINT_POLICY_KEY);
    if (!row) return FALLBACK_DAILY_HINT_SETTINGS;

    const settings = settingsFromRow(row);

    log.debug('read', 'Daily hint policy loaded', {
        key: DAILY_HINT_POLICY_KEY,
        revision: settings.revision,
        scope: settings.scope,
        start_level: settings.policy.startLevel,
        stagger: settings.policy.stagger,
    });

    return settings;
}

async function readDailyFeedbackSettings(): Promise<DailyFeedbackSettings> {
    const row = await readSettingsRow(DAILY_FEEDBACK_KEY);
    if (!row) return FALLBACK_DAILY_FEEDBACK_SETTINGS;

    const settings = feedbackFromRow(row);

    log.debug('read', 'Daily reward-feedback policy loaded', {
        key: DAILY_FEEDBACK_KEY,
        revision: settings.revision,
        sound_enabled: settings.policy.soundEnabled,
        volume: settings.policy.volume,
        burst_from: settings.policy.burstFrom,
        flourish: settings.policy.flourish,
    });

    return settings;
}

/**
 * The daily game's hint settings, cached across requests.
 *
 * Never throws and never returns a partial value — a failed read degrades to
 * `FALLBACK_DAILY_HINT_SETTINGS` and says so in the log. Callers can treat the
 * result as always usable.
 */
export const getDailyHintSettings = unstable_cache(
    readDailyHintSettings,
    ['daily-hint-settings'],
    { tags: [GAME_SETTINGS_TAG], revalidate: REVALIDATE_SECONDS },
);

/**
 * How rewarding a correct guess is, cached across requests.
 *
 * Same contract as the hint settings, and it shares their cache tag: one admin
 * save revalidates both, which is what keeps the two panels on one page from
 * disagreeing about which revision is live.
 */
export const getDailyFeedbackSettings = unstable_cache(
    readDailyFeedbackSettings,
    ['daily-feedback-settings'],
    { tags: [GAME_SETTINGS_TAG], revalidate: REVALIDATE_SECONDS },
);
