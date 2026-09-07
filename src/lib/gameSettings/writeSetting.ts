import { revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase-admin';
import { createLogger } from '@/lib/logger';
import { GAME_SETTINGS_TAG } from './server';

const log = createLogger('game-settings/write');

export type WriteSettingArgs = {
    key: string;
    /** Already normalised by the key's own parser, so this is what will be served. */
    value: unknown;
    /** Stored verbatim; keys with no scope of their own pass 'default'. */
    scope: 'default' | 'force';
    /** Admin performing the write, for the audit trail. */
    userId: string;
};

export type WriteSettingResult =
    | { ok: true; revision: number }
    | { ok: false; error: string; status: number };

/**
 * Writes one `game_settings` row, bumps its revision, records the change, and
 * expires the read cache.
 *
 * Shared by every settings key rather than reimplemented per panel: the
 * revision counter and the history entry are what make "did that change help?"
 * answerable, and a second panel that forgot either of them would put a hole in
 * the record that only shows up months later when someone asks.
 *
 * Runs through the service-role client because `game_settings` has RLS with no
 * write policy — the anon key in the browser bundle cannot reach it. The
 * caller's `requireAdmin` check is therefore the whole of the authorisation.
 */
export async function writeSetting({
    key,
    value,
    scope,
    userId,
}: WriteSettingArgs): Promise<WriteSettingResult> {
    const supabase = createAdminClient();

    // Read-then-write rather than `revision = revision + 1`, which supabase-js
    // cannot express. The panel has a single writer, so the race window between
    // the two statements is not worth an RPC.
    const { data: current, error: readError } = await supabase
        .from('game_settings')
        .select('revision')
        .eq('key', key)
        .maybeSingle<{ revision: number | null }>();

    if (readError) {
        log.error('read', 'Could not read the current revision before saving', {
            user_id: userId,
            key,
        }, readError);
        return { ok: false, error: 'Could not read the current settings', status: 500 };
    }

    const revision = (current?.revision ?? 0) + 1;

    const { error: writeError } = await supabase
        .from('game_settings')
        .upsert({
            key,
            value,
            scope,
            revision,
            updated_by: userId,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

    if (writeError) {
        log.error('write', 'Failed to save a game setting', {
            user_id: userId,
            key,
            revision,
        }, writeError);
        return { ok: false, error: 'Could not save the settings', status: 500 };
    }

    // Audit trail. A failure here does not fail the request — the setting is
    // already live, and refusing to report that would be worse than a gap in
    // the history — but it is logged as an error because a missing entry breaks
    // the "what changed on the 14th" question the table exists to answer.
    const { error: historyError } = await supabase
        .from('game_settings_history')
        .insert({ key, value, scope, revision, updated_by: userId });

    if (historyError) {
        log.error('history', 'Setting saved but the history entry failed to write', {
            user_id: userId,
            key,
            revision,
        }, historyError);
    }

    // 'max' fully expires the tag rather than merely marking it stale, so the
    // next read of the daily page gets the new policy instead of serving the
    // previous one for the remainder of its 60s window.
    revalidateTag(GAME_SETTINGS_TAG, 'max');

    return { ok: true, revision };
}
