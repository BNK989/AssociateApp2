import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import { createLogger } from '@/lib/logger';
import { DEFAULT_HINT_POLICY, parseHintPolicy } from '@/lib/daily/hintPolicy';
import {
    DAILY_HINT_POLICY_KEY,
    GAME_SETTINGS_TAG,
    getDailyHintSettings,
} from '@/lib/gameSettings/server';

export const dynamic = 'force-dynamic';

const log = createLogger('api/admin/game-settings');

/**
 * Reads the daily hint policy for the admin panel.
 *
 * Returns the compiled defaults alongside the stored value so the panel can
 * show, per field, what the code would do if the setting were cleared — which
 * is what makes "reset to default" meaningful rather than a guess.
 */
export async function GET() {
    const auth = await requireAdmin();

    if (!auth.ok) {
        log.warn('auth', 'Rejected a read of the game settings', { reason: auth.reason });
        return NextResponse.json({ error: auth.reason }, { status: auth.status });
    }

    const settings = await getDailyHintSettings();

    return NextResponse.json({
        key: DAILY_HINT_POLICY_KEY,
        policy: settings.policy,
        scope: settings.scope,
        revision: settings.revision,
        codeDefault: DEFAULT_HINT_POLICY,
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Saves a new daily hint policy.
 *
 * The write runs through the service-role client: `game_settings` has RLS with
 * no write policy, so the anon key in the browser bundle cannot reach it. The
 * `requireAdmin` check above is therefore the whole of the authorisation.
 *
 * The submitted policy is normalised through `parseHintPolicy` and the stored
 * result is echoed back, so the panel always shows what was actually written
 * rather than what it hoped to write.
 */
export async function PUT(request: Request) {
    const auth = await requireAdmin();

    if (!auth.ok) {
        log.warn('auth', 'Rejected a write to the game settings', { reason: auth.reason });
        return NextResponse.json({ error: auth.reason }, { status: auth.status });
    }

    let body: unknown;

    try {
        body = await request.json();
    } catch (e) {
        log.warn('parse', 'Settings write rejected: body was not valid JSON', { user_id: auth.userId }, e);
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!isRecord(body)) {
        return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
    }

    // Scope is rejected rather than normalised. Silently coercing it would flip
    // whether the policy binds every player or only new ones, which is too
    // consequential to guess at on the player's behalf.
    if (body.scope !== 'default' && body.scope !== 'force') {
        log.warn('validate', 'Settings write rejected: scope must be "default" or "force"', {
            user_id: auth.userId,
            received: String(body.scope),
        });
        return NextResponse.json({ error: 'scope must be "default" or "force"' }, { status: 400 });
    }

    const scope = body.scope;
    const policy = parseHintPolicy(body.policy);

    const supabase = createAdminClient();

    // Read-then-write rather than `revision = revision + 1`, which supabase-js
    // cannot express. The panel has a single writer, so the race window between
    // the two statements is not worth an RPC.
    const { data: current, error: readError } = await supabase
        .from('game_settings')
        .select('revision')
        .eq('key', DAILY_HINT_POLICY_KEY)
        .maybeSingle<{ revision: number | null }>();

    if (readError) {
        log.error('read', 'Could not read the current revision before saving', {
            user_id: auth.userId,
            key: DAILY_HINT_POLICY_KEY,
        }, readError);
        return NextResponse.json({ error: 'Could not read the current settings' }, { status: 500 });
    }

    const revision = (current?.revision ?? 0) + 1;

    const { error: writeError } = await supabase
        .from('game_settings')
        .upsert({
            key: DAILY_HINT_POLICY_KEY,
            value: policy,
            scope,
            revision,
            updated_by: auth.userId,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

    if (writeError) {
        log.error('write', 'Failed to save the daily hint policy', {
            user_id: auth.userId,
            key: DAILY_HINT_POLICY_KEY,
            revision,
        }, writeError);
        return NextResponse.json({ error: 'Could not save the settings' }, { status: 500 });
    }

    // Audit trail. A failure here does not fail the request — the setting is
    // already live, and refusing to report that would be worse than a gap in
    // the history — but it is logged as an error because a missing entry breaks
    // the "what changed on the 14th" question the table exists to answer.
    const { error: historyError } = await supabase
        .from('game_settings_history')
        .insert({
            key: DAILY_HINT_POLICY_KEY,
            value: policy,
            scope,
            revision,
            updated_by: auth.userId,
        });

    if (historyError) {
        log.error('history', 'Settings saved but the history entry failed to write', {
            user_id: auth.userId,
            key: DAILY_HINT_POLICY_KEY,
            revision,
        }, historyError);
    }

    // 'max' fully expires the tag rather than merely marking it stale, so the
    // next read of the daily page gets the new policy instead of serving the
    // previous one for the remainder of its 60s window.
    revalidateTag(GAME_SETTINGS_TAG, 'max');

    log.info('write', 'Daily hint policy saved', {
        user_id: auth.userId,
        revision,
        scope,
        start_level: policy.startLevel,
        applies_to: policy.startLevelAppliesTo,
        stagger: policy.stagger,
        progression: policy.progression,
        auto_enabled: policy.autoEnabled,
    });

    return NextResponse.json({ policy, scope, revision });
}
