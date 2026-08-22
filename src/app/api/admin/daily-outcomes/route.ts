import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import { createLogger } from '@/lib/logger';
import { summariseByRevision, type ResultRow } from '@/lib/daily/outcomeStats';
import { isMissingColumn, isMissingTable } from '@/lib/supabaseErrors';

export const dynamic = 'force-dynamic';

const log = createLogger('api/admin/daily-outcomes');

/** How far back the read-out looks. */
const LOOKBACK_DAYS = 30;

/**
 * Ceiling on rows pulled back.
 *
 * The aggregation runs here rather than in SQL because it needs no database
 * function to deploy, and at this game's scale the row count is small. The cap
 * is what keeps that true — if it is ever hit, this should become an RPC.
 */
const MAX_ROWS = 5_000;

const COLUMNS = 'settings_revision, play_date, words_total, words_solved, score, '
    + 'hints_used, strikes, duration_ms, completed, per_word';

/** Same query without the column that may not be migrated yet. */
const COLUMNS_WITHOUT_REVISION = COLUMNS.replace('settings_revision, ', '');

function since(days: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
}

/**
 * How each configuration has actually played, for the admin panel.
 *
 * Grouped by `settings_revision`, which is what makes a change judgeable: plays
 * are attributed to the configuration in force when they happened rather than
 * split by date, and a player who cached their game keeps their old revision.
 */
export async function GET() {
    const auth = await requireAdmin();

    if (!auth.ok) {
        log.warn('auth', 'Rejected a read of the daily outcomes', { reason: auth.reason });
        return NextResponse.json({ error: auth.reason }, { status: auth.status });
    }

    const supabase = createAdminClient();
    const from = since(LOOKBACK_DAYS);

    const query = (columns: string) => supabase
        .from('daily_results')
        .select(columns)
        .gte('play_date', from)
        .order('play_date', { ascending: false })
        .limit(MAX_ROWS);

    let { data, error } = await query(COLUMNS);

    // Deployed ahead of the schema: still worth showing the numbers that exist,
    // just without the attribution that is the point of the page.
    let revisionColumnMissing = false;
    if (error && isMissingColumn(error)) {
        revisionColumnMissing = true;
        ({ data, error } = await query(COLUMNS_WITHOUT_REVISION));
    }

    if (error) {
        if (isMissingTable(error)) {
            log.warn('read', 'daily_results does not exist; no outcomes to report', { since: from });
            return NextResponse.json({ stats: [], plays: 0, since: from, unavailable: true });
        }

        log.error('read', 'Failed to read daily results for the outcomes read-out', { since: from }, error);
        return NextResponse.json({ error: 'Could not read results' }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as ResultRow[];
    const normalised = revisionColumnMissing
        ? rows.map((r) => ({ ...r, settings_revision: null }))
        : rows;

    return NextResponse.json({
        stats: summariseByRevision(normalised),
        plays: normalised.length,
        since: from,
        revisionColumnMissing,
        truncated: normalised.length >= MAX_ROWS,
    });
}
