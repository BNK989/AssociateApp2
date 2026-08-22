import { motion } from 'framer-motion';
import { floatVariant } from './cipherVariants';
import type { ScrambleItem } from './cipherRules';

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
 * Colour carries the information: green is a letter in its confirmed position,
 * orange is a letter known to be in the word but still loose, grey is filler.
 * Green tiles are pinned, so a tile that moves is one the player still has to
 * place.
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

                const colorClass = isPlaced
                    ? 'text-green-600 dark:text-green-400'
                    : isLoose
                        ? 'text-orange-500 dark:text-orange-400'
                        : 'text-gray-400 dark:text-gray-500';

                return (
                    <motion.span
                        layout
                        key={item.id}
                        custom={i}
                        variants={floatVariant}
                        animate={item.isReal ? 'float' : undefined}
                        className={`inline-block ${item.isSpace ? 'whitespace-pre' : ''} ${item.isReal
                            ? `font-bold mx-0.5 drop-shadow-[0_0_2px_rgba(255,255,255,0.5)] ${colorClass}`
                            : 'text-gray-400 dark:text-gray-500 font-medium'
                            } ${i === 0 && hintLevel >= 1 ? 'uppercase' : ''}`}
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
