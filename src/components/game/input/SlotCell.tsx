import { motion } from 'framer-motion';
import { SETTLE_SPRING } from '@/components/game/pool/poolMotion';
import type { Slot } from '@/lib/letterPool/slotRules';

type SlotCellProps = {
    slot: Slot;
    /** The caret sits here: this is the next cell the player will fill. */
    isCaret: boolean;
    reduced: boolean;
    /**
     * The letter is still in the air. The cell keeps its rule and its caret and
     * draws nothing, so the player never sees the same letter in two places at
     * once — the flight arrives, and only then does this fill.
     */
    held?: boolean;
};

/**
 * One cell of the composer's strip.
 *
 * Its width comes from `--slot-w`, computed once per word by the strip, so a
 * keystroke changes only what is drawn inside a cell and never the geometry
 * around it. That is what keeps typing smooth: no reflow, no layout animation,
 * nothing for the browser to recompute between frames.
 *
 * The three states reuse the board's own tile palette rather than inventing a
 * second one, so a green in the strip is the same green as the green in the
 * word above it.
 */
export function SlotCell({ slot, isCaret, reduced, held = false }: SlotCellProps) {
    if (slot.kind === 'gap') {
        // A space is drawn as the gap between word groups, never as a cell; a
        // hyphen or apostrophe is scenery the player is given.
        return (
            <span
                aria-hidden="true"
                className="flex-none select-none self-center text-muted-foreground"
                style={{ width: 'calc(var(--slot-w) * 0.5)', fontSize: 'var(--slot-font)' }}
            >
                {slot.char}
            </span>
        );
    }

    const isGreen = slot.kind === 'green';
    const tone = slot.conflict
        ? 'text-destructive'
        : isGreen
            ? 'text-[var(--tile-placed)]'
            : slot.poolId
                ? 'text-[var(--tile-present)]'
                : 'text-foreground';

    const rule = slot.conflict
        ? 'bg-destructive'
        : isGreen
            ? 'bg-[var(--tile-placed)]'
            : slot.poolId
                ? 'bg-[var(--tile-present)]'
                : slot.char
                    ? 'bg-border'
                    : 'bg-border/70';

    return (
        <span
            data-slot-index={slot.index}
            className={`relative grid flex-none place-items-center rounded-md ${
                isGreen && !slot.conflict ? 'bg-[var(--tile-placed)]/12' : ''
            }`}
            style={{ width: 'var(--slot-w)', height: 'calc(var(--slot-w) * 1.2)' }}
        >
            {slot.char && !held && (
                <motion.span
                    // No `layoutId` pairing with the halo tile. The halo lives in
                    // the scrolling message list and this cell in the composer,
                    // and framer's shared-layout projection reports stale
                    // positions across a scroll container — the letter would
                    // launch from the wrong place. The halo tile shrinks away
                    // where it hangs and this cell pops at the same moment.
                    initial={reduced ? false : { scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={reduced ? { duration: 0 } : SETTLE_SPRING}
                    className={`font-bold uppercase leading-[1.2] ${tone}`}
                    style={{ fontSize: 'var(--slot-font)' }}
                >
                    {slot.char}
                </motion.span>
            )}

            <span
                aria-hidden="true"
                className={`absolute inset-x-1 bottom-0.5 h-0.5 rounded-full ${rule} ${
                    isCaret ? 'slot-caret bg-primary' : ''
                }`}
            />
        </span>
    );
}
