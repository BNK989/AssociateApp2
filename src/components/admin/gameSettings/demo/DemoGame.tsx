'use client';

import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DailyHintPolicy } from '@/lib/daily/hintPolicy';
import { DemoBoard } from './DemoBoard';

/**
 * A playable daily game driven by the settings currently being edited.
 *
 * The timeline above it answers "when do the hints land"; this answers the
 * question the timeline cannot, which is what the board actually *looks* like —
 * whether every word is scrambled from the outset or only the one in front of
 * the player, what a start level of 3 gives away, what a solve is worth once
 * free hints stop being charged for.
 *
 * It plays the draft, not what is saved, so a game master can try a change
 * before shipping it to anyone. Nothing here is persisted: no localStorage, no
 * result rows, no analytics.
 */
export function DemoGame({ policy }: { policy: DailyHintPolicy }) {
    const [run, setRun] = useState(0);

    // Remounting is the reset: it clears the board, the score and the hint
    // countdown together, which is exactly what changing a setting should do.
    const policyKey = useMemo(() => JSON.stringify(policy), [policy]);

    return (
        <section className="rounded-lg border border-border bg-background p-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">Try it</h2>

                <Button variant="outline" size="sm" onClick={() => setRun((prev) => prev + 1)}>
                    <RotateCcw className="me-2 h-4 w-4" />
                    Restart the demo
                </Button>
            </div>

            <p className="mb-4 text-xs text-muted-foreground">
                A throwaway chain played against the settings above, including the ones you
                have not saved yet. It restarts whenever you change one. Nothing you do here
                is recorded, and no player sees it.
            </p>

            <DemoBoard key={`${policyKey}-${run}`} policy={policy} />
        </section>
    );
}
