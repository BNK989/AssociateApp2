'use client';

import { useMemo, useState } from 'react';
import { CipherChars } from './cipher/CipherChars';
import { ScrambleView } from './cipher/ScrambleView';
import { buildRandomCipher, computeGuessState } from './cipher/cipherRules';
import { LETTER_POOL } from '@/lib/gameConfig';
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
    /**
     * Positions the settle drip has walked into place.
     *
     * Folded into the green set below rather than carried as a fourth state:
     * `letter_feedback.md` is explicit that a settled letter is green in every
     * sense the player is asked to learn, and the composer has always drawn it
     * that way. The bubble did not, so the two surfaces disagreed about the same
     * word — the strip read `PUL__Y` while the bubble above still showed nothing
     * but cipher glyphs.
     */
    settled?: number[];
    /**
     * Draw only what the line can say honestly. Defaults to the pool being on,
     * where letters with no confirmed place are shown in the composer's pool
     * rather than inside the word — see `knowledge base/letter_feedback.md`.
     */
    hideUnplaced?: boolean;
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
    settled,
    hideUnplaced = LETTER_POOL.ENABLED,
}: CipherTextProps) {
    const dir = RTL_RANGE.test(text) ? 'rtl' : 'ltr';

    // Generated once. Keeping the randomness in useState's initialiser keeps it
    // off the render path on every subsequent render.
    const [generatedCipher] = useState(() => buildRandomCipher(text));
    const activeCipher = cipherText || generatedCipher;

    const guessesKey = guesses.join(',');
    const settledKey = settled?.join(',') ?? '';
    const guessState = useMemo(() => {
        if (visible) {
            return { greenIndices: new Set<number>(), revealedChars: new Set<string>() };
        }

        const state = computeGuessState(text, guesses);
        if (!settled?.length) return state;

        // A settled letter is confirmed in place, which is what a green is.
        // Merged here so both views get it from one place and neither has to
        // learn a new state.
        return {
            revealedChars: state.revealedChars,
            greenIndices: new Set([...state.greenIndices, ...settled]),
        };
        // The two keys stand in for the array identities, which change every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, guessesKey, settledKey, visible]);

    const { display, scrambleItems } = useCipherAnimation({
        text,
        activeCipher,
        cipherText,
        visible,
        hintLevel,
        forceScramble,
        guesses,
        // Nothing in the line is loose any more, so there is nothing to shuffle.
        scrambling: !hideUnplaced,
    });

    const flashingIndices = useRevealFlash(cipherText, text, visible);

    // Colons bracket a locally masked word, marking it as not yet server-backed.
    const showColons = !visible && !cipherText;

    if (scrambleItems && !visible && !hideUnplaced) {
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
            hideUnplaced={hideUnplaced}
            className={className}
            dir={dir}
            showColons={showColons}
        />
    );
}
