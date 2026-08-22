import { Lock } from 'lucide-react';
import type { DailyHintPolicy } from '@/lib/daily/hintPolicy';
import { previewTimeline } from '@/lib/daily/hintSchedule';

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

/**
 * What a player experiences on a fresh word, under the policy being edited.
 *
 * The panel's numbers do not read the same way under both stagger modes —
 * 15/30/60 means the last hint lands at 105s under `per-rung` and at 60s under
 * `cumulative` — so a game master editing delays cannot tell what they have
 * built from the inputs alone. The timings come from the real scheduler, so
 * this cannot drift from what players actually get.
 */
export function HintTimeline({ policy }: { policy: DailyHintPolicy }) {
    const entries = previewTimeline(policy);

    return (
        <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="mb-3 text-sm font-medium text-foreground">
                On a fresh word, the player sees
            </div>

            <ol className="flex flex-wrap items-stretch gap-2">
                <li className="flex flex-col justify-center rounded-md border border-border bg-background px-3 py-2">
                    <span className="text-xs text-muted-foreground">word opens</span>
                    <span className="text-sm font-semibold text-foreground">0s</span>
                </li>

                {entries.map((entry) => (
                    <li
                        key={entry.level}
                        className="flex items-center gap-2"
                    >
                        <span aria-hidden className="text-muted-foreground">&rarr;</span>

                        <div
                            className={`flex flex-col justify-center rounded-md border px-3 py-2 ${entry.atSeconds === null
                                ? 'border-dashed border-border bg-background'
                                : 'border-border bg-background'
                                }`}
                        >
                            <span className="text-xs text-muted-foreground">
                                {LEVEL_NAMES[entry.level] ?? `Level ${entry.level}`}
                            </span>

                            {entry.atSeconds === null ? (
                                <span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                                    <Lock className="h-3 w-3" />
                                    manual only
                                </span>
                            ) : (
                                <span className="text-sm font-semibold text-foreground">
                                    {formatSeconds(entry.atSeconds)}
                                </span>
                            )}
                        </div>
                    </li>
                ))}
            </ol>

            {entries.some((e) => e.atSeconds === null) && (
                <p className="mt-3 text-xs text-muted-foreground">
                    The ladder stops there. Anything past it is still reachable, but only
                    when the player presses the hint button.
                </p>
            )}
        </div>
    );
}
