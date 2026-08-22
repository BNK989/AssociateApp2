/**
 * Rolling `daily_results` up by the configuration that produced them.
 *
 * This is the half that makes game-master controls a loop rather than a set of
 * knobs. Grouping by `settings_revision` rather than by date is deliberate: a
 * player caches their game in localStorage and keeps playing the previous
 * configuration for the rest of the day, so results either side of a change are
 * not cleanly split by time. The revision travels with the play.
 */

export type ResultRow = {
    settings_revision: number | null;
    play_date: string;
    words_total: number;
    words_solved: number;
    score: number;
    hints_used: number;
    strikes: number;
    duration_ms: number;
    completed: boolean;
    per_word: unknown;
};

export type RevisionStats = {
    /** Null for rows recorded before the column existed. */
    revision: number | null;
    /** Rows, which is one per browser per day. */
    plays: number;
    /** Share of plays that finished the chain, 0–1. */
    completionRate: number;
    /** Typical number of words solved. */
    medianSolved: number;
    /** Typical number of words reached, solved or not — where players stop. */
    medianReached: number;
    /** Hints taken per word reached. The clearest read on whether help is flowing. */
    hintsPerWord: number;
    /** Typical attention spent per word reached. */
    medianMsPerWord: number;
    /** Typical score. */
    medianScore: number;
    firstSeen: string;
    lastSeen: string;
};

/** Middle value, averaging the two middles for an even count. */
export function median(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

/** How many words the player actually reached, from the per-word log. */
export function wordsReached(row: ResultRow): number {
    return Array.isArray(row.per_word) ? row.per_word.length : 0;
}

function round(value: number, places: number): number {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
}

/**
 * One summary row per configuration, newest revision first.
 *
 * Rows with no revision sort last: they predate the column and cannot be
 * compared against anything, but dropping them would misreport how much data
 * there is.
 */
export function summariseByRevision(rows: ResultRow[]): RevisionStats[] {
    const groups = new Map<string, ResultRow[]>();

    for (const row of rows) {
        const key = row.settings_revision === null ? 'null' : String(row.settings_revision);
        const group = groups.get(key);
        if (group) group.push(row);
        else groups.set(key, [row]);
    }

    const stats: RevisionStats[] = [];

    for (const [key, group] of groups) {
        const reached = group.map(wordsReached);
        const totalReached = reached.reduce((sum, n) => sum + n, 0);
        const totalHints = group.reduce((sum, r) => sum + (r.hints_used || 0), 0);
        const totalMs = group.reduce((sum, r) => sum + (r.duration_ms || 0), 0);
        const dates = group.map((r) => r.play_date).sort();

        stats.push({
            revision: key === 'null' ? null : Number(key),
            plays: group.length,
            completionRate: round(group.filter((r) => r.completed).length / group.length, 3),
            medianSolved: median(group.map((r) => r.words_solved || 0)),
            medianReached: median(reached),
            // Per word reached, not per play: a play that stopped at word two is
            // not evidence about the hints on words three through five.
            hintsPerWord: totalReached === 0 ? 0 : round(totalHints / totalReached, 2),
            medianMsPerWord: totalReached === 0 ? 0 : Math.round(totalMs / totalReached),
            medianScore: median(group.map((r) => r.score || 0)),
            firstSeen: dates[0],
            lastSeen: dates[dates.length - 1],
        });
    }

    return stats.sort((a, b) => {
        if (a.revision === null) return 1;
        if (b.revision === null) return -1;
        return b.revision - a.revision;
    });
}
