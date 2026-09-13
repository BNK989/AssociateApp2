import { useMemo } from 'react';
import { layoutHalo, type HaloPlacement } from '@/lib/letterPool/haloLayout';
import { occupiedIds } from '@/lib/letterPool/haloRoster';
import type { PoolLetter } from '@/lib/letterPool/poolRules';
import { useHaloRoster } from './useHaloRoster';

/**
 * Where the loose letters hang, and which of them are still there to draw.
 *
 * Lifted out of the composer, which is at the file-size cap and has no business
 * knowing how a halo is solved. Two lists come back because they are genuinely
 * different questions:
 *
 * - **`placements`** is every letter the word has ever had loose, laid out. The
 *   flights read this one, so a letter still has somewhere to be measured from
 *   on the frame it leaves the pool.
 * - **`visible`** is the subset still loose, which is what gets drawn. A letter
 *   that found its place leaves a gap rather than closing the ranks up — see
 *   `haloRoster` for why that matters.
 */
export function useComposerHalo(
    pool: PoolLetter[],
    targetId: string | undefined,
    mirror: boolean,
): { placements: HaloPlacement[]; visible: HaloPlacement[] } {
    const roster = useHaloRoster(pool, targetId);

    const placements = useMemo(() => layoutHalo(roster, mirror), [roster, mirror]);

    const visible = useMemo(() => {
        const live = occupiedIds(pool);
        return placements.filter((placement) => live.has(placement.id));
    }, [placements, pool]);

    return { placements, visible };
}

/**
 * The position a pool chip stands for.
 *
 * The id is the word's own index behind a prefix, which is what lets a tap name
 * one of two identical letters. Returns null rather than guessing if that shape
 * ever changes, so a tap does nothing instead of settling the wrong letter.
 */
export function slotIndexOfPoolId(poolId: string): number | null {
    const index = Number(poolId.slice(poolId.lastIndexOf('-') + 1));
    return Number.isInteger(index) && index >= 0 ? index : null;
}
