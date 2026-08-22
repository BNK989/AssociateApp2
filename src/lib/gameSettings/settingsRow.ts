import {
    DEFAULT_HINT_POLICY,
    parseHintPolicy,
    type GameMasterHintSettings,
} from '@/lib/daily/hintPolicy';

/**
 * Turning a `game_settings` row into settings the game can play by.
 *
 * Kept apart from `server.ts` so it can be tested without dragging in
 * `next/cache` and the Supabase client. `server.ts` is then only I/O.
 */

/**
 * Revision reported when the table could not be read. Distinguishable from any
 * real revision, which starts at 1 — so a `daily_results` row stamped 0 means
 * "played against the compiled defaults", not "played against revision 0".
 */
export const NO_REVISION = 0;

export type DailyHintSettings = GameMasterHintSettings & {
    /** The configuration's revision, stamped onto results for attribution. */
    revision: number;
};

/**
 * What the game plays by when the table is empty, missing, or unreachable.
 *
 * This is the floor the whole design rests on: the daily game must not depend
 * on a settings table being present. Before the migration is applied, and after
 * any failure to read it, play continues exactly as it did before game-master
 * controls existed.
 */
export const FALLBACK_DAILY_HINT_SETTINGS: DailyHintSettings = {
    policy: DEFAULT_HINT_POLICY,
    scope: 'default',
    revision: NO_REVISION,
};

/**
 * Codes meaning "this table does not exist yet".
 *
 * Two of them, because the answer depends on who is asked. Raw Postgres returns
 * the SQLSTATE `42P01`, but supabase-js goes through PostgREST, which answers
 * from its schema cache and reports `PGRST205` instead. Checking only the
 * SQLSTATE looks right when tested with a direct SQL query and still logs an
 * error through the client, which is exactly the wolf-crying this branch exists
 * to avoid.
 */
export const MISSING_TABLE_CODES = ['42P01', 'PGRST205'] as const;

export type SettingsRow = {
    value: unknown;
    scope: string | null;
    revision: number | null;
};

/**
 * Whether a read failed only because the migration has not been applied yet.
 *
 * Worth distinguishing: it is an expected state between merging this code and
 * deploying the migration, and logging it as an error would train the reader to
 * ignore a line that means something real everywhere else.
 */
export function isMissingTable(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) return false;

    const code = (error as { code?: unknown }).code;
    return typeof code === 'string'
        && (MISSING_TABLE_CODES as readonly string[]).includes(code);
}

/**
 * Narrows a row into settings, falling back per field.
 *
 * `scope` is treated as `default` unless it says `force`, so an unrecognised
 * value fails safe: a policy that only seeds new players cannot be turned into
 * one that overrides everybody by a typo in the column.
 */
export function settingsFromRow(row: SettingsRow | null | undefined): DailyHintSettings {
    if (!row) return FALLBACK_DAILY_HINT_SETTINGS;

    return {
        policy: parseHintPolicy(row.value),
        scope: row.scope === 'force' ? 'force' : 'default',
        revision: typeof row.revision === 'number' && Number.isFinite(row.revision)
            ? row.revision
            : NO_REVISION,
    };
}
