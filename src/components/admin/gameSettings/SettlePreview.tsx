import { useMemo } from 'react';
import { settleAllowance } from '@/lib/daily/settleRules';
import type { SettlePolicy } from '@/lib/daily/settlePolicy';

/**
 * What the current settings actually do, spelled out on real words.
 *
 * The two floors interact in a way nobody reads correctly off two dropdowns:
 * half of an eleven-letter word is five, half of a four-letter word is two, and
 * the minimum overrides both on anything short. A game master raising the share
 * needs to see the consequence on the words the game actually uses, not do the
 * arithmetic themselves — this is the same job `HintTimeline` does for the
 * ladder.
 *
 * The sample words are chosen for their lengths, not their meanings: four, six,
 * eight and eleven letters, which bracket the daily chain's range.
 */
const SAMPLES = ['OPAL', 'PEACOAT', 'STARLING', 'CONSTELLATION'];

export function SettlePreview({ policy }: { policy: SettlePolicy }) {
    const rows = useMemo(
        () => SAMPLES.map((word) => ({
            word,
            allowance: settleAllowance(word, policy),
        })),
        [policy],
    );

    if (policy.mode === 'off') {
        return (
            <div className="mt-4 rounded-md border border-border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">
                    Off. A stuck player who has spent the hint ladder is offered the reveal and
                    nothing else, which is how the game behaved before this rung existed.
                </p>
            </div>
        );
    }

    return (
        <div className="mt-4 rounded-md border border-border bg-muted/40 p-4">
            <div className="mb-2 text-sm font-medium text-foreground">
                What this does
            </div>

            <p className="mb-3 text-xs text-muted-foreground">
                {policy.mode === 'auto'
                    ? `Letters start landing after ${Math.round(policy.firstDelayMs / 1000)}s on the word, then one every ${Math.round(policy.intervalMs / 1000)}s, without the player asking.`
                    : `The player is offered the drip once they have gone quiet and the hint ladder is spent. Accepting lands a letter at once, then one every ${Math.round(policy.intervalMs / 1000)}s.`}
            </p>

            <ul className="space-y-1">
                {rows.map((row) => (
                    <li key={row.word} className="flex items-baseline gap-2 text-xs">
                        <code className="rounded bg-background px-1 py-0.5 font-mono text-foreground">
                            {row.word}
                        </code>
                        <span className="text-muted-foreground">
                            {row.allowance === 0
                                ? 'nothing settles — the minimum leaves no room'
                                : `up to ${row.allowance} of ${row.word.length} letters, leaving ${row.word.length - row.allowance} to solve`}
                        </span>
                    </li>
                ))}
            </ul>

            <p className="mt-3 text-xs text-muted-foreground">
                It can also stop early. Only letters the player has already found may be placed, so
                a word with little in the pool runs out of candidates before it reaches the cap —
                which is why the <code>allowance</code> rides along on every settle event.
            </p>
        </div>
    );
}
