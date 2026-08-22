/**
 * Recognising the two ways the database says "that does not exist yet".
 *
 * Both matter because migrations are applied by hand here, so there is always a
 * window where deployed code is ahead of the schema. Code that reaches for a
 * table or column added in an unapplied migration has to degrade rather than
 * fail, and to say which migration is missing when it does.
 *
 * Note that the answer depends on who is asked. Raw Postgres returns SQLSTATEs;
 * supabase-js goes through PostgREST, which answers from its own schema cache
 * with its own codes. Checking only the SQLSTATE looks correct when tested with
 * a direct SQL query and still fails through the client.
 */

/** "This table does not exist": Postgres SQLSTATE, then PostgREST's schema cache. */
export const MISSING_TABLE_CODES = ['42P01', 'PGRST205'] as const;

/** "This column does not exist": Postgres SQLSTATE, then PostgREST's schema cache. */
export const MISSING_COLUMN_CODES = ['42703', 'PGRST204'] as const;

function hasCode(error: unknown, codes: readonly string[]): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) return false;

    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' && codes.includes(code);
}

/** Whether a read or write failed only because the table has not been created. */
export function isMissingTable(error: unknown): boolean {
    return hasCode(error, MISSING_TABLE_CODES);
}

/** Whether a write failed only because one of its columns does not exist yet. */
export function isMissingColumn(error: unknown): boolean {
    return hasCode(error, MISSING_COLUMN_CODES);
}
