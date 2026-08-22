'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createLogger } from '@/lib/logger';
import type { RevisionStats } from '@/lib/daily/outcomeStats';

const log = createLogger('admin/outcomes');

type OutcomesResponse = {
    stats: RevisionStats[];
    plays: number;
    since: string;
    revisionColumnMissing?: boolean;
    unavailable?: boolean;
};

function percent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

function seconds(ms: number): string {
    return ms === 0 ? '—' : `${Math.round(ms / 1000)}s`;
}

/**
 * How each configuration has actually played.
 *
 * The panel above changes the rules; this says whether the change helped. Rows
 * are one per revision, newest first, so a change is judged against the one
 * before it rather than against a date range that mixes both.
 */
export function OutcomesPanel({ currentRevision }: { currentRevision: number }) {
    const [data, setData] = useState<OutcomesResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setFailed(false);

        try {
            const res = await fetch('/api/admin/daily-outcomes');
            if (!res.ok) throw new Error(`status ${res.status}`);
            setData(await res.json());
        } catch (e) {
            log.error('load', 'Could not load the daily outcomes read-out', undefined, e);
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <section className="rounded-lg border border-border bg-background p-5">
            <div className="mb-1 flex items-center justify-between gap-4">
                <h2 className="text-base font-semibold text-foreground">How it has played</h2>
                <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    <span className="sr-only">Refresh</span>
                </Button>
            </div>

            <p className="mb-4 text-xs text-muted-foreground">
                Grouped by the revision in force when each game was played, not by date —
                a player who started before a change keeps playing the old one.
            </p>

            {failed && (
                <p className="text-sm text-muted-foreground">
                    Could not load the results. The log has the detail.
                </p>
            )}

            {!failed && loading && !data && (
                <p className="text-sm text-muted-foreground">Loading…</p>
            )}

            {data?.revisionColumnMissing && (
                <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
                    Results are not attributed yet. Apply{' '}
                    <code className="rounded bg-muted px-1 py-0.5">
                        20260823090000_add_settings_revision_to_daily_results.sql
                    </code>.
                </p>
            )}

            {data && data.stats.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground">
                    No games recorded since {data.since}.
                </p>
            )}

            {data && data.stats.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-start text-xs text-muted-foreground">
                                <th className="py-2 pe-4 text-start font-medium">Revision</th>
                                <th className="py-2 pe-4 text-start font-medium">Plays</th>
                                <th className="py-2 pe-4 text-start font-medium">Finished</th>
                                <th className="py-2 pe-4 text-start font-medium">Reached</th>
                                <th className="py-2 pe-4 text-start font-medium">Solved</th>
                                <th className="py-2 pe-4 text-start font-medium">Hints/word</th>
                                <th className="py-2 pe-4 text-start font-medium">Time/word</th>
                                <th className="py-2 pe-4 text-start font-medium">Score</th>
                                <th className="py-2 text-start font-medium">Dates</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.stats.map((s) => (
                                <tr
                                    key={String(s.revision)}
                                    className="border-b border-border/50 last:border-b-0"
                                >
                                    <td className="py-2 pe-4 font-medium text-foreground">
                                        {s.revision === null ? 'unattributed' : s.revision}
                                        {s.revision === currentRevision && (
                                            <span className="ms-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                                                live
                                            </span>
                                        )}
                                        {s.revision === 0 && (
                                            <span className="ms-2 text-[10px] text-muted-foreground">
                                                code defaults
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2 pe-4">{s.plays}</td>
                                    <td className="py-2 pe-4">{percent(s.completionRate)}</td>
                                    <td className="py-2 pe-4">{s.medianReached}</td>
                                    <td className="py-2 pe-4">{s.medianSolved}</td>
                                    <td className="py-2 pe-4">{s.hintsPerWord}</td>
                                    <td className="py-2 pe-4">{seconds(s.medianMsPerWord)}</td>
                                    <td className="py-2 pe-4">{s.medianScore}</td>
                                    <td className="py-2 text-xs text-muted-foreground">
                                        {s.firstSeen === s.lastSeen
                                            ? s.firstSeen
                                            : `${s.firstSeen} → ${s.lastSeen}`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <p className="mt-3 text-xs text-muted-foreground">
                        Reached is how many words a player got through, solved or not — where
                        they stop is the drop-off. Hints and time are per word reached, so a
                        short play does not skew them.
                    </p>
                </div>
            )}
        </section>
    );
}
