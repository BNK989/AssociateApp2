import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createLogger } from '@/lib/logger';
import { countStreak, parseResultPayload } from '@/lib/daily/dailyResults';
import { isMissingColumn } from '@/lib/supabaseErrors';

const log = createLogger('api/daily/result');

/** Slack around today, so a player mid-game across UTC midnight is not rejected. */
const DATE_SLACK_DAYS = 1;

function isoDay(offsetDays: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10);
}

function isPlayableDate(playDate: string): boolean {
    return playDate >= isoDay(-DATE_SLACK_DAYS) && playDate <= isoDay(DATE_SLACK_DAYS);
}

/** Furthest back a streak is counted. Beyond this the number stops being a hook. */
const MAX_STREAK_LOOKBACK = 400;

/**
 * Consecutive days finished, counting back from this one.
 *
 * Computed here rather than on the client because the client only knows about
 * today -- yesterday's game lives in a localStorage key it has no reason to
 * read, and a player switching devices would lose the streak entirely.
 *
 * Identity is client id OR account, so signing in part-way through a run keeps
 * the streak that was built as a guest on the same browser.
 */
async function computeStreak(
    supabase: ReturnType<typeof createAdminClient>,
    clientId: string,
    userId: string | null,
    playDate: string,
): Promise<number> {
    const identity = userId
        ? `client_id.eq.${clientId},user_id.eq.${userId}`
        : `client_id.eq.${clientId}`;

    const { data, error } = await supabase
        .from('daily_results')
        .select('play_date')
        .or(identity)
        .eq('completed', true)
        .lte('play_date', playDate)
        .order('play_date', { ascending: false })
        .limit(MAX_STREAK_LOOKBACK);

    if (error) {
        log.warn('streak', 'Could not read history for the streak; reporting none', { play_date: playDate }, error);
        return 0;
    }

    return countStreak((data ?? []).map((row) => row.play_date), playDate);
}

/**
 * Records a player's progress through the day's chain.
 *
 * Called after every resolved word, not only at the end, so the row reflects
 * how far a player who quit actually got. Writes run through the service-role
 * client: `daily_results` has RLS with no write policy, so the anon key in the
 * browser bundle cannot reach the table at all.
 *
 * The daily game is scored in the browser and always has been, so this endpoint
 * cannot verify that a score was earned. What it does enforce is that the shape
 * is possible -- the chain length comes from the stored game rather than the
 * request, the date must be one currently in play, and progress may not go
 * backwards -- so a single bad client cannot distort the measurements.
 */
export async function POST(request: Request) {
    let body: unknown;

    try {
        body = await request.json();
    } catch (e) {
        log.warn('parse', 'Result rejected: body was not valid JSON', undefined, e);
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const playDate = typeof body === 'object' && body !== null && 'play_date' in body
        ? String((body as { play_date: unknown }).play_date)
        : null;

    if (!playDate || !isPlayableDate(playDate)) {
        log.warn('validate', 'Result rejected: play_date is not currently in play', { play_date: playDate });
        return NextResponse.json({ error: 'play_date is not in play' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: game, error: gameError } = await supabase
        .from('daily_games')
        .select('words')
        .eq('play_date', playDate)
        .maybeSingle();

    if (gameError) {
        log.error('load_game', 'Failed to load the day\'s chain while recording a result', { play_date: playDate }, gameError);
        return NextResponse.json({ error: 'Could not verify the day\'s game' }, { status: 500 });
    }

    if (!game?.words?.length) {
        log.warn('load_game', 'Result rejected: no chain exists for that date', { play_date: playDate });
        return NextResponse.json({ error: 'No game for that date' }, { status: 404 });
    }

    const parsed = parseResultPayload(body, game.words.length);

    if (!parsed.ok) {
        log.warn('validate', 'Result rejected as malformed', { play_date: playDate, reason: parsed.reason });
        return NextResponse.json({ error: parsed.reason }, { status: 400 });
    }

    const { payload } = parsed;

    // Attach the account when there is one. Guests have no session and are
    // recorded against their client id alone.
    let userId: string | null = null;
    const authHeader = request.headers.get('authorization');

    if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data, error } = await supabase.auth.getUser(token);
        if (error) {
            log.debug('auth', 'Bearer token did not resolve to a user, recording as a guest', { play_date: playDate });
        }
        userId = data?.user?.id ?? null;
    }

    // Progress may not regress. Without this, reopening a finished game would
    // let the fresh empty log overwrite the completed one -- and a second tab
    // would do the same mid-game.
    const { data: existing } = await supabase
        .from('daily_results')
        .select('per_word, completed')
        .eq('client_id', payload.client_id)
        .eq('play_date', playDate)
        .maybeSingle();

    if (existing) {
        const existingProgress = Array.isArray(existing.per_word) ? existing.per_word.length : 0;
        const regressing = payload.per_word.length < existingProgress
            || (existing.completed && !payload.completed);

        if (regressing) {
            log.debug('upsert', 'Ignored a result that would have moved progress backwards', {
                play_date: playDate,
                stored_progress: existingProgress,
                incoming_progress: payload.per_word.length,
            });
            return NextResponse.json({ ok: true, ignored: 'stale' });
        }
    }

    const row = { ...payload, user_id: userId, updated_at: new Date().toISOString() };

    let { error: upsertError } = await supabase
        .from('daily_results')
        .upsert(row, { onConflict: 'client_id,play_date' });

    // Deployed code can run ahead of the schema here, since migrations are
    // applied by hand. Losing every result until someone remembers to migrate
    // would cost exactly the measurements this table exists for, so drop the
    // column the database does not have and record the rest.
    if (upsertError && isMissingColumn(upsertError)) {
        log.warn('upsert', 'daily_results has no settings_revision column; recording without it. '
            + 'Apply supabase/migrations/20260823090000_add_settings_revision_to_daily_results.sql '
            + 'to attribute results to a configuration', { play_date: playDate });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit the column
        const { settings_revision, ...withoutRevision } = row;
        ({ error: upsertError } = await supabase
            .from('daily_results')
            .upsert(withoutRevision, { onConflict: 'client_id,play_date' }));
    }

    if (upsertError) {
        log.error('upsert', 'Failed to record daily result', {
            play_date: playDate,
            user_id: userId,
            progress: payload.per_word.length,
            completed: payload.completed,
        }, upsertError);
        return NextResponse.json({ error: 'Could not record result' }, { status: 500 });
    }

    // Only worth a query once the day is actually finished; an unfinished game
    // has no streak to report and this runs after every single word.
    const streak = payload.completed
        ? await computeStreak(supabase, payload.client_id, userId, playDate)
        : null;

    return NextResponse.json({ ok: true, streak });
}
