'use client';

import { useMemo, useState } from 'react';
import { CipherChars } from './cipher/CipherChars';
import { ScrambleView } from './cipher/ScrambleView';
import { buildRandomCipher, computeGuessState } from './cipher/cipherRules';
import { useCipherAnimation } from './cipher/useCipherAnimation';
import { useRevealFlash } from './cipher/useRevealFlash';

/** Hebrew block; presence of it flips the word to right-to-left. */
const RTL_RANGE = /[֐-׿]/;

interface CipherTextProps {
    text: string;
    /** Server-authored mask. Falls back to a locally generated one. */
    cipherText?: string;
    /** True once the word is solved and may be shown in full. */
    visible: boolean;
    className?: string;
    isSolving?: boolean;
    hintLevel?: number;
    /** Bumping this counter re-shuffles the tiles on demand. */
    forceScramble?: number;
    guesses?: string[];
}

/**
 * Renders a word either masked or revealed, and animates between the two.
 *
 * This is the component that hides the game's answers, so the rules governing
 * what may be shown live in `./cipher/cipherRules` under test, rather than
 * being tangled up with the animation.
 */
export function CipherText({
    text,
    cipherText,
    visible,
    className = '',
    isSolving = false,
    hintLevel = 0,
    forceScramble,
    guesses = [],
}: CipherTextProps) {
    const dir = RTL_RANGE.test(text) ? 'rtl' : 'ltr';

    // Generated once. Keeping the randomness in useState's initialiser keeps it
    // off the render path on every subsequent render.
    const [generatedCipher] = useState(() => buildRandomCipher(text));
    const activeCipher = cipherText || generatedCipher;

    const guessesKey = guesses.join(',');
    const guessState = useMemo(
        () => (visible ? { greenIndices: new Set<number>(), revealedChars: new Set<string>() }
            : computeGuessState(text, guesses)),
        // guessesKey stands in for the array identity, which changes every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [text, guessesKey, visible],
    );

    const { display, scrambleItems } = useCipherAnimation({
        text,
        activeCipher,
        cipherText,
        visible,
        hintLevel,
        forceScramble,
        guesses,
    });

    const flashingIndices = useRevealFlash(cipherText, text, visible);

    // Colons bracket a locally masked word, marking it as not yet server-backed.
    const showColons = !visible && !cipherText;

    if (scrambleItems && !visible) {
        return (
            <ScrambleView
                items={scrambleItems}
                hintLevel={hintLevel}
                className={className}
                dir={dir}
                showColons={showColons}
            />
        );
    }

    return (
        <CipherChars
            display={display}
            text={text}
            visible={visible}
            guessState={guessState}
            hintLevel={hintLevel}
            isSolving={isSolving}
            flashingIndices={flashingIndices}
            className={className}
            dir={dir}
            showColons={showColons}
        />
    );
}
