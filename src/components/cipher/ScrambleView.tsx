import { motion } from 'framer-motion';
import { floatVariant } from './cipherVariants';
import { tileClassName } from './tileStyles';
import type { ScrambleItem, TileState } from './cipherRules';

type ScrambleViewProps = {
    items: ScrambleItem[];
    hintLevel: number;
    className: string;
    dir: 'ltr' | 'rtl';
    showColons: boolean;
};

const COLON = '∷';

/**
 * The shuffled-tile view used from hint level 2.
 *
 * Colour says what a tile is; motion says whether its slot can be trusted.
 * Pinned letters sit at their real index and are drawn still, loose ones have
 * been shuffled and drift — so a tile that moves is one the player still has to
 * place, and one that does not is settled.
 *
 * That was always the intent, and the docstring said so, but the animation was
 * gated on `isReal`, which is true of pinned tiles too. Every revealed letter
 * drifted, including the ones already in position, and the only cue that could
 * carry "not placed yet" carried nothing.
 */
export function ScrambleView({ items, hintLevel, className, dir, showColons }: ScrambleViewProps) {
    return (
        <motion.span dir={dir} className={`${className} break-words inline-flex flex-wrap gap-1`}>
            {showColons && (
                <span className="me-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>
            )}

            {items.map((item, i) => {
                const isPlaced = Boolean(item.locked) && item.isReal;
                const isLoose = !item.locked && item.isReal;

                const state: TileState = isPlaced ? 'placed' : isLoose ? 'present' : 'unknown';

                return (
                    <motion.span
                        layout
                        key={item.id}
                        custom={i}
                        variants={floatVariant}
                        animate={isLoose ? 'float' : undefined}
                        className={`inline-block ${item.isSpace ? 'whitespace-pre' : ''} ${tileClassName(state)} ${item.isReal ? 'mx-0.5' : ''} ${i === 0 && hintLevel >= 1 ? 'uppercase' : ''}`}
                        transition={{ layout: { duration: 0.4, ease: 'easeInOut' } }}
                    >
                        {item.char}
                    </motion.span>
                );
            })}

            {showColons && (
                <span className="ms-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>
            )}
        </motion.span>
    );
}
