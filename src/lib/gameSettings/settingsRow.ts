import {
    DEFAULT_HINT_POLICY,
    parseHintPolicy,
    type GameMasterHintSettings,
} from '@/lib/daily/hintPolicy';
import {
    DEFAULT_FEEDBACK_POLICY,
    parseFeedbackPolicy,
    type DailyFeedbackPolicy,
} from '@/lib/daily/feedbackPolicy';

// Re-exported so callers of this module do not need to know where the error
// codes live; the definition is shared with the daily-results write path.
export { isMissingTable } from '@/lib/supabaseErrors';

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

export type SettingsRow = {
    value: unknown;
    scope: string | null;
    revision: number | null;
};

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

/* ------------------------------------------------------------------ *
 * Reward feedback
 * ------------------------------------------------------------------ */

export type DailyFeedbackSettings = {
    policy: DailyFeedbackPolicy;
    /** The configuration's revision, so a change can be attributed. */
    revision: number;
};

/**
 * What reward feedback falls back to when the row is absent or unreadable.
 *
 * Same floor rule as the hint settings: a missing `daily_feedback` row is a
 * normal state (the code ships before the migration is applied) and must play
 * exactly like the compiled defaults rather than fall silent.
 */
export const FALLBACK_DAILY_FEEDBACK_SETTINGS: DailyFeedbackSettings = {
    policy: DEFAULT_FEEDBACK_POLICY,
    revision: NO_REVISION,
};

/**
 * Narrows a row into reward-feedback settings.
 *
 * `scope` is ignored on purpose. Reward audio has no `force`: a player who
 * muted the game stays muted whatever a game master sets, so there is no
 * scope for the column to express. See `resolveFeedbackPolicy`.
 */
export function feedbackFromRow(row: SettingsRow | null | undefined): DailyFeedbackSettings {
    if (!row) return FALLBACK_DAILY_FEEDBACK_SETTINGS;

    return {
        policy: parseFeedbackPolicy(row.value),
        revision: typeof row.revision === 'number' && Number.isFinite(row.revision)
            ? row.revision
            : NO_REVISION,
    };
}
