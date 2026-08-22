import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createLogger } from '@/lib/logger';
import { generateAndStoreDailyGame } from '@/lib/dailyGameGenerator';
import { planForDate } from '@/lib/daily/themeWheel';

const log = createLogger('api/daily/pregenerate');

/** How far ahead puzzles are prepared. */
const HORIZON_DAYS = 7;

/**
 * Dates generated per invocation.
 *
 * Each date can cost several model round-trips once retries are counted, and
 * the whole run shares one function timeout. In steady state only one date is
 * ever missing, so this only bites on a cold start -- which then fills in over
 * a few nights rather than timing out every night.
 */
const MAX_PER_RUN = 3;

export const maxDuration = 60;

function isoDay(offsetDays: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10);
}

/**
 * Prepares the coming week's puzzles.
 *
 * Generation used to happen lazily: the first player to open /daily on a given
 * day created that day's chain. That meant nobody could look at a puzzle before
 * it went live, a day with no visitors produced no row at all (2026-08-18 and
 * 19 are simply missing), and the first player of the day waited on the model.
 *
 * Running ahead of time fixes all three, and gives the existing hint cron rows
 * to work on rather than finding an empty table.
 *
 * Authorised with the service-role key, matching the `generate-daily-hints`
 * job that already runs this way.
 */
export async function POST(request: Request) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
        log.error('auth', 'SUPABASE_SERVICE_ROLE_KEY is not configured; cannot authorise pre-generation');
        return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
    }

    const presented = request.headers.get('authorization')?.replace('Bearer ', '');

    if (presented !== serviceKey) {
        log.warn('auth', 'Rejected an unauthorised pre-generation request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const horizon = Array.from({ length: HORIZON_DAYS + 1 }, (_, i) => isoDay(i));

    const { data: existing, error } = await supabase
        .from('daily_games')
        .select('play_date')
        .in('play_date', horizon);

    if (error) {
        log.error('scan', 'Could not read the upcoming schedule', { horizon_days: HORIZON_DAYS }, error);
        return NextResponse.json({ error: 'Could not read the schedule' }, { status: 500 });
    }

    const present = new Set((existing ?? []).map((row) => row.play_date));
    const missing = horizon.filter((date) => !present.has(date));
    const target = missing.slice(0, MAX_PER_RUN);

    const created: Array<{ play_date: string; theme: string; words: number }> = [];
    const failed: string[] = [];

    for (const date of target) {
        try {
            const game = await generateAndStoreDailyGame(date);
            created.push({ play_date: date, theme: game.theme, words: game.words.length });

            log.info('generate', 'Prepared an upcoming daily game', {
                play_date: date,
                theme: game.theme,
                words: game.words.length,
                domain: planForDate(date).domain,
            });
        } catch (e) {
            failed.push(date);
            log.error('generate', 'Failed to prepare an upcoming daily game', { play_date: date }, e);
        }
    }

    const remaining = missing.length - target.length;

    log.info('run', 'Pre-generation finished', {
        created: created.length,
        failed: failed.length,
        already_present: present.size,
        deferred_to_next_run: remaining,
    });

    return NextResponse.json({
        ok: failed.length === 0,
        created,
        failed,
        deferred: remaining,
    });
}
