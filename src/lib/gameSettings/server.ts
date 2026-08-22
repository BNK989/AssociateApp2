import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';
import {
    FALLBACK_DAILY_HINT_SETTINGS,
    isMissingTable,
    settingsFromRow,
    type DailyHintSettings,
    type SettingsRow,
} from './settingsRow';

// Server-only: this reads the game_settings table on the server and is imported
// by server components and API routes. Never import it from a client component.

const log = createLogger('game-settings');

/** Cache tag revalidated whenever an admin saves, so edits land immediately. */
export const GAME_SETTINGS_TAG = 'game-settings';

export const DAILY_HINT_POLICY_KEY = 'daily_hint_policy';

/**
 * Ceiling on how long a stale policy may be served. The admin route revalidates
 * the tag on write, so this only bounds drift from a write that happened
 * somewhere else (a direct SQL edit, or another deployment).
 */
const REVALIDATE_SECONDS = 60;

export {
    FALLBACK_DAILY_HINT_SETTINGS,
    NO_REVISION,
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

async function readDailyHintSettings(): Promise<DailyHintSettings> {
    const { data, error } = await anonClient()
        .from('game_settings')
        .select('value, scope, revision')
        .eq('key', DAILY_HINT_POLICY_KEY)
        .maybeSingle<SettingsRow>();

    if (error) {
        if (isMissingTable(error)) {
            log.warn(
                'read',
                'game_settings table does not exist; the daily game is running on the compiled defaults. '
                + 'Apply supabase/migrations/20260822140000_create_game_settings.sql to enable game-master controls',
                { key: DAILY_HINT_POLICY_KEY },
            );
        } else {
            log.error(
                'read',
                'Failed to read the daily hint policy; falling back to the compiled defaults',
                { key: DAILY_HINT_POLICY_KEY },
                error,
            );
        }
        return FALLBACK_DAILY_HINT_SETTINGS;
    }

    if (!data) {
        log.warn(
            'read',
            'No daily_hint_policy row in game_settings; falling back to the compiled defaults',
            { key: DAILY_HINT_POLICY_KEY },
        );
        return FALLBACK_DAILY_HINT_SETTINGS;
    }

    const settings = settingsFromRow(data);

    log.debug('read', 'Daily hint policy loaded', {
        key: DAILY_HINT_POLICY_KEY,
        revision: settings.revision,
        scope: settings.scope,
        start_level: settings.policy.startLevel,
        stagger: settings.policy.stagger,
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
