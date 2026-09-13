import { useState } from 'react';
import { mergeRoster } from '@/lib/letterPool/haloRoster';
import type { PoolLetter } from '@/lib/letterPool/poolRules';

/**
 * Holds the halo's roster across renders, and starts a fresh one per word.
 *
 * Adjusted during render rather than in an effect, which is React's own pattern
 * for state that follows a prop. It has to be: the roster must be correct in
 * the very render that reads it, because the layout solved from it is what a
 * letter's flight measures its starting point against. A render late and the
 * letter leaves from the wrong place.
 *
 * The adjustment converges after one pass — `mergeRoster` hands back the list
 * it was given whenever nothing is new, so the second render sets nothing.
 *
 * The reset is keyed on the word rather than on the pool emptying, so a word
 * whose letters have all been placed does not hand its spots to the next one.
 */
export function useHaloRoster(pool: PoolLetter[], targetId?: string): PoolLetter[] {
    const [held, setHeld] = useState<{ targetId?: string; roster: PoolLetter[] }>(
        () => ({ targetId, roster: pool }),
    );

    if (held.targetId !== targetId) {
        setHeld({ targetId, roster: pool });
        return pool;
    }

    const roster = mergeRoster(held.roster, pool);
    if (roster !== held.roster) setHeld({ targetId, roster });

    return roster;
}
