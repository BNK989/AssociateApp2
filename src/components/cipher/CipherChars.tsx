import { motion } from 'framer-motion';
import { SPECIAL_CHARS, type GuessState } from './cipherRules';
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
 * upgraded to the real letter only where the player has earned it — green for
 * a confirmed position, orange for a letter known to be present.
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
    const { greenIndices, revealedChars } = guessState;

    const wrapperClass = `${className} break-words inline-flex flex-wrap ${(visible || hintLevel >= 1 || isSolving) ? '[&>span:first-child]:uppercase' : ''} ${isSolving ? 'gap-1' : ''}`;

    return (
        <motion.span dir={dir} className={wrapperClass}>
            {showColons && (
                <span className="me-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>
            )}

            {displayChars.map((char, i) => {
                const realChar = textChars[i];
                const isPositionalMatch = char === realChar;

                if (visible) {
                    return (
                        <span
                            key={i}
                            className={`${char === ' ' ? 'whitespace-pre' : ''} ${isPositionalMatch ? '' : 'text-green-500 opacity-70'}`}
                        >
                            {char}
                        </span>
                    );
                }

                let renderChar = char;
                let isEffectiveMatch = isPositionalMatch;
                let colorClass = '';

                if (greenIndices.has(i) && realChar) {
                    renderChar = realChar;
                    isEffectiveMatch = true;
                    colorClass = 'text-green-600 dark:text-green-400';
                } else if (realChar && revealedChars.has(realChar.toLowerCase())) {
                    renderChar = realChar;
                    isEffectiveMatch = true;
                    colorClass = 'text-orange-500 dark:text-orange-400';
                } else {
                    // From level 2 the mask is an anagram of real letters, so
                    // anything that is not filler is styled as a letter tile.
                    if (hintLevel >= 2 && !SPECIAL_CHARS.has(char) && char !== ' ') {
                        isEffectiveMatch = true;
                    }
                    if (!isEffectiveMatch) {
                        colorClass = 'text-gray-400 dark:text-gray-500 font-medium';
                    }
                }

                const isFlashing = flashingIndices.has(i);

                return (
                    <motion.span
                        layout
                        key={`${i}-${renderChar}`}
                        custom={isEffectiveMatch ? i : isEffectiveMatch}
                        animate={isFlashing ? 'pop' : (hintLevel >= 2 && isEffectiveMatch) ? 'float' : undefined}
                        variants={isFlashing ? popVariant : floatVariant}
                        className={`inline-block ${char === ' ' ? 'whitespace-pre' : ''} ${isEffectiveMatch
                            ? `font-bold drop-shadow-[0_0_2px_rgba(255,255,255,0.5)] ${colorClass || 'text-inherit'} ${hintLevel >= 2 ? 'mx-0.5' : ''}`
                            : colorClass
                            }`}
                    >
                        {renderChar}
                    </motion.span>
                );
            })}

            {showColons && (
                <span className="ms-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>
            )}
        </motion.span>
    );
}
