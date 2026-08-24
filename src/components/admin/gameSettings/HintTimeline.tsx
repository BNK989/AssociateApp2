import { Lock } from 'lucide-react';
import type { DailyHintPolicy } from '@/lib/daily/hintPolicy';
import { previewTimeline, type TimelineEntry } from '@/lib/daily/hintSchedule';

const LEVEL_NAMES: Record<number, string> = {
    1: 'First letter',
    2: 'Scramble',
    3: 'AI clue',
};

function formatSeconds(seconds: number): string {
    if (seconds === 0) return 'immediately';
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds % 60);
    return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

function Step({ label, value, dashed = false }: { label: string; value: React.ReactNode; dashed?: boolean }) {
    return (
        <div
            className={`flex flex-col justify-center rounded-md border px-3 py-2 ${dashed ? 'border-dashed' : ''
                } border-border bg-background`}
        >
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className={`text-sm font-semibold ${dashed ? 'text-muted-foreground' : 'text-foreground'}`}>
                {value}
            </span>
        </div>
    );
}

function Track({ caption, entries }: { caption: string; entries: TimelineEntry[] }) {
    return (
        <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">{caption}</div>

            <ol className="flex flex-wrap items-stretch gap-2">
                <li className="flex">
                    <Step label="word opens" value="0s" />
                </li>

                {entries.map((entry) => (
                    <li key={entry.level} className="flex items-center gap-2">
                        <span aria-hidden className="text-muted-foreground">&rarr;</span>

                        <Step
                            label={LEVEL_NAMES[entry.level] ?? `Level ${entry.level}`}
                            dashed={entry.atSeconds === null}
                            value={entry.atSeconds === null ? (
                                <span className="flex items-center gap-1">
                                    <Lock className="h-3 w-3" />
                                    manual only
                                </span>
                            ) : formatSeconds(entry.atSeconds)}
                        />
                    </li>
                ))}
            </ol>
        </div>
    );
}

/**
 * What a player experiences on a fresh word, under the policy being edited.
 *
 * The panel's numbers do not read the same way under both stagger modes —
 * 15/30/60 means the last hint lands at 105s under `per-rung` and at 60s under
 * `cumulative` — so a game master editing delays cannot tell what they have
 * built from the inputs alone. The timings come from the real scheduler, so
 * this cannot drift from what players actually get.
 *
 * Under `first-word` the chain has two different timelines and showing only the
 * first is a lie: it promises a scramble on arrival that every word after the
 * first never gets. Both are drawn, from the same scheduler.
 */
export function HintTimeline({ policy }: { policy: DailyHintPolicy }) {
    const entries = previewTimeline(policy);

    const splitsChain = policy.startLevelAppliesTo === 'first-word' && policy.startLevel > 0;
    const laterEntries = splitsChain ? previewTimeline({ ...policy, startLevel: 0 }) : null;

    const stopsEarly = [...entries, ...(laterEntries ?? [])].some((e) => e.atSeconds === null);

    return (
        <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="mb-3 text-sm font-medium text-foreground">
                On a fresh word, the player sees
            </div>

            <div className="space-y-4">
                <Track
                    caption={splitsChain ? 'The first word they play' : 'Every word'}
                    entries={entries}
                />

                {laterEntries && (
                    <Track caption="Every word after it" entries={laterEntries} />
                )}
            </div>

            {stopsEarly && (
                <p className="mt-3 text-xs text-muted-foreground">
                    The ladder stops there. Anything past it is still reachable, but only
                    when the player presses the hint button.
                </p>
            )}
        </div>
    );
}
