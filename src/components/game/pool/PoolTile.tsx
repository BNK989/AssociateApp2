import { motion } from 'framer-motion';
import { driftStyle, PLACE_SPRING, SPAWN_SPRING } from './poolMotion';
import type { PoolLetter } from '@/lib/letterPool/poolRules';

type PoolTileProps = {
    letter: PoolLetter;
    /** False once the letter has been drawn into a slot. */
    isHome: boolean;
    drifting: boolean;
    reduced: boolean;
};

/**
 * One socket in the pool, and the letter sitting in it.
 *
 * The socket and the letter are separate on purpose. The socket never leaves:
 * it holds the row's width steady so placing a letter cannot reflow the pool,
 * and it leaves a visible origin for the letter to fly back to. The letter is
 * the thing that travels, and it carries a `layoutId` so framer morphs it into
 * the slot rather than cross-fading two different elements.
 */
export function PoolTile({ letter, isHome, drifting, reduced }: PoolTileProps) {
    // Density is a media query rather than a measured prop: a short viewport is
    // a rendering concern, and reading it in JavaScript would cost a state
    // update on every keyboard open for something CSS already knows.
    const size = 'h-8 w-8 text-sm max-[660px]:h-7 max-[660px]:w-7 max-[660px]:text-xs';

    return (
        <div
            style={driftStyle(letter.id, drifting && !reduced && isHome)}
            className={`pool-socket relative grid flex-none place-items-center rounded-xl border border-dashed ${size} ${
                isHome
                    ? 'border-[var(--tile-present)]/55 bg-[var(--tile-present)]/10'
                    : 'border-border/60 bg-transparent'
            }`}
        >
            {isHome && (
                <motion.span
                    // Shared with the slot cell: the same element in two places,
                    // so the move is one continuous thing rather than two.
                    layoutId={reduced ? undefined : `letter-${letter.id}`}
                    initial={reduced ? false : { scale: 0.55, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={reduced ? { duration: 0 } : SPAWN_SPRING}
                    // Only handed to the compositor while it is actually moving.
                    style={{ willChange: 'transform' }}
                    className="font-bold leading-[1.2] text-[var(--tile-present)] drop-shadow-[0_0_2px_var(--tile-glow)]"
                >
                    {letter.char}
                </motion.span>
            )}
        </div>
    );
}

/** The transition the slot cell must use for the same letter, kept side by side. */
export const POOL_HANDOFF = PLACE_SPRING;
