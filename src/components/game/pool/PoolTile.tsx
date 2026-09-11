import { motion } from 'framer-motion';
import { driftStyle, PLACE_SPRING, SPAWN_SPRING } from './poolMotion';
import type { PoolLetter } from '@/lib/letterPool/poolRules';

type PoolTileProps = {
    letter: PoolLetter;
    /** False once the letter has been drawn into a slot. */
    isHome: boolean;
    drifting: boolean;
    reduced: boolean;
    /** Position in the row, which staggers the arrival. */
    order: number;
};

/**
 * One letter adrift in the pool, and the space it leaves when it is placed.
 *
 * The socket and the letter are separate on purpose. The socket never leaves:
 * it holds the row's width steady so placing a letter cannot reflow the pool,
 * and it leaves a visible origin for the letter to fly back to. The letter is
 * the thing that travels, and it carries a `layoutId` so framer morphs it into
 * the slot rather than cross-fading two different elements.
 *
 * **No box.** The socket used to draw a dashed, tinted square around every
 * letter, which made the pool a grid of cells — and a grid of cells is a
 * structure with positions in it, which is the one thing the pool must not
 * suggest. What is left is the letter, a seeded angle, and a dotted rule under
 * it. The rule is not decoration: it is the non-hue channel that carries
 * "found, unplaced" for a player who cannot separate the orange from the green
 * (WCAG 1.4.1), and it survives greyscale and a screenshot exactly as the
 * word line's underlines do.
 */
export function PoolTile({ letter, isHome, drifting, reduced, order }: PoolTileProps) {
    // Density is a media query rather than a measured prop: a short viewport is
    // a rendering concern, and reading it in JavaScript would cost a state
    // update on every keyboard open for something CSS already knows.
    // Short, because the dotted rule is the letter's own underline and has to
    // sit under it. Centred in a tall socket it read as a separate tick floating
    // below the glyph, and a row of ticks is the grid this change removed.
    const size = 'h-6 w-7 text-sm max-[660px]:h-5 max-[660px]:w-6 max-[660px]:text-xs';

    return (
        <div
            style={{
                ...driftStyle(letter.id, drifting && !reduced && isHome),
                // The pool sits flush with the start of the field, where the
                // strip below it starts. Only the gaps *between* tiles are
                // irregular; an indented first tile would just look misaligned.
                ...(order === 0 ? { '--pool-gap': '0px' } : null),
            }}
            className={`pool-socket relative grid flex-none items-end justify-items-center pb-px border-b-2 border-dotted ${size} ${
                isHome ? 'border-[var(--tile-present)]/70' : 'border-border/25'
            }`}
        >
            {isHome && (
                <motion.span
                    // Shared with the slot cell: the same element in two places,
                    // so the move is one continuous thing rather than two.
                    layoutId={reduced ? undefined : `letter-${letter.id}`}
                    initial={reduced ? false : { scale: 0.5, opacity: 0, y: 6 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={reduced ? { duration: 0 } : { ...SPAWN_SPRING, delay: order * 0.05 }}
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
