import { motion } from 'framer-motion';
import { readMaskTile, type GuessState } from './cipherRules';
import { tileClassName } from './tileStyles';
import { floatVariant, popVariant } from './cipherVariants';

type CipherCharsProps = {
    display: string;
    text: string;
    visible: boolean;
    guessState: GuessState;
    hintLevel: number;
    isSolving: boolean;
    flashingIndices: Set<number>;
    className: string;
    dir: 'ltr' | 'rtl';
    showColons: boolean;
};

const COLON = '∷';

/**
 * The default character-by-character view, used whenever the word is not in
 * its shuffled state.
 *
 * When the word is solved it renders plainly. While masked, each position is
 * upgraded to the real letter only where the player has earned it.
 */
export function CipherChars({
    display,
    text,
    visible,
    guessState,
    hintLevel,
    isSolving,
    flashingIndices,
    className,
    dir,
    showColons,
}: CipherCharsProps) {
    const textChars = [...text];
    const displayChars = [...display];

    const wrapperClass = `${className} break-words inline-flex flex-wrap ${(visible || hintLevel >= 1 || isSolving) ? '[&>span:first-child]:uppercase' : ''} ${isSolving ? 'gap-1' : ''}`;

    return (
        <motion.span dir={dir} className={wrapperClass}>
            {showColons && (
                <span className="me-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>
            )}

            {displayChars.map((char, i) => {
                const realChar = textChars[i];

                if (visible) {
                    return (
                        <span
                            key={i}
                            className={`${char === ' ' ? 'whitespace-pre' : ''} ${char === realChar ? '' : 'text-[var(--tile-placed)] opacity-70'}`}
                        >
                            {char}
                        </span>
                    );
                }

                const tile = readMaskTile(char, realChar, i, guessState, hintLevel);
                const isFlashing = flashingIndices.has(i);

                return (
                    <motion.span
                        layout
                        key={`${i}-${tile.char}`}
                        custom={isFlashing ? tile.state !== 'unknown' : i}
                        // Motion means one thing only: this slot is not the
                        // letter's own. Anything settled stays still, so
                        // stillness is what marks a position as trustworthy.
                        animate={isFlashing ? 'pop' : tile.displaced ? 'float' : undefined}
                        variants={isFlashing ? popVariant : floatVariant}
                        className={`inline-block ${char === ' ' ? 'whitespace-pre' : ''} ${tileClassName(tile.state)} ${tile.displaced ? 'mx-0.5' : ''}`}
                    >
                        {tile.char}
                    </motion.span>
                );
            })}

            {showColons && (
                <span className="ms-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>
            )}
        </motion.span>
    );
}
