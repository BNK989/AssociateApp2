'use client';

import { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DemoBoard } from './DemoBoard';
import type { DemoPolicies } from './demoPolicies';

/**
 * A playable daily game driven by the settings currently being edited.
 *
 * The timeline above it answers "when do the hints land"; this answers the
 * question the timeline cannot, which is what the board actually *looks* like —
 * whether every word opens hinted from the outset or only the one in front of
 * the player, what a start level of 3 gives away, what a solve is worth once
 * free hints stop being charged for.
 *
 * All four drafts drive it, not just the ladder: the fork appears where the
 * fork settings put it, the drip runs at the pace they set, the letter pool
 * behaves as configured and a solve bursts the way the reward settings say.
 *
 * It plays the draft, not what is saved, so a game master can try a change
 * before shipping it to anyone. Nothing here is persisted: no localStorage, no
 * result rows, no analytics.
 */
export function DemoGame({ policies }: { policies: DemoPolicies }) {
    const [run, setRun] = useState(0);

    /**
     * The board is deliberately client-only.
     *
     * Its words arrive masked by `generateCipherString`, which draws every
     * filler glyph at random, so a server-rendered board and the one that
     * hydrates over it disagree on almost every letter and React throws the
     * whole subtree away. The real game never hits this: it builds its chain
     * from a callback after mount, not in a state initializer.
     *
     * Waiting for the client rather than seeding the masking, because the
     * seed would have to reach into the shipped game's own module to serve a
     * preview, and there is nothing here a first paint owes anyone.
     */
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // Remounting is the reset: it clears the board, the score and the hint
    // countdown together, which is exactly what changing a setting should do.
    const policyKey = useMemo(() => JSON.stringify(policies), [policies]);

    return (
        <section className="rounded-lg border border-border bg-background p-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">Try it</h3>

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

            {mounted
                ? <DemoBoard key={`${policyKey}-${run}`} policies={policies} />
                // Holds the column's height for the one frame before mount, so
                // the pinned panel does not jump the fields being edited.
                : <div className="min-h-96" aria-hidden="true" />}
        </section>
    );
}
