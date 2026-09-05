import { useEffect, useRef, useState } from 'react';
import { buildScrambleItems, computeGuessState, generateShuffledView, type ScrambleItem } from './cipherRules';

/** Total time the scramble takes to settle. */
const SCRAMBLE_DURATION_MS = 600;

/** Pause after the final shuffle before the view resolves. */
const SETTLE_MS = 500;

/** Bounds on the per-character morph step, so short and long words feel alike. */
const MORPH_MIN_MS = 30;
const MORPH_MAX_MS = 100;
const MORPH_TOTAL_MS = 1000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type UseCipherAnimationArgs = {
    text: string;
    activeCipher: string;
    cipherText?: string;
    visible: boolean;
    hintLevel: number;
    forceScramble?: number;
    guesses: string[];
};

/**
 * Drives the two ways a masked word can change on screen.
 *
 * A *scramble* is used from hint level 2, where letters are shuffled into new
 * positions and float loose. A *morph* is used otherwise, sweeping character by
 * character from the old string to the new — including the reveal on a solve.
 *
 * Every await is followed by a cancellation check. Without them a word solved
 * mid-animation would have its hint view written back afterwards and be stuck
 * masked forever.
 */
export function useCipherAnimation({
    text,
    activeCipher,
    cipherText,
    visible,
    hintLevel,
    forceScramble,
    guesses,
}: UseCipherAnimationArgs) {
    const [display, setDisplay] = useState(visible ? text : activeCipher);

    /**
     * A word that opens already at hint 2 gets its tiles up front.
     *
     * The scramble used to exist only as the *output* of an animation, so a word
     * mounted at hint 2 — scrolled into view on a board seeded by the
     * `every-word` start reach, or restored on reload — rendered through
     * `CipherChars` until something happened to trigger a shuffle, and then
     * changed appearance for no reason the player could see. Which view runs is
     * now a function of the word's state, not of what has happened to it.
     *
     * Built without shuffling: from level 2 the server's mask is already an
     * anagram, so its own order is the resting arrangement.
     */
    const [scrambleItems, setScrambleItems] = useState<ScrambleItem[] | null>(() => (
        !visible && hintLevel >= 2
            ? buildScrambleItems({
                textChars: [...text],
                cipherChars: [...activeCipher],
                guessState: computeGuessState(text, guesses),
                hintLevel,
            })
            : null
    ));

    const isFirstRender = useRef(true);
    const lastForceScrambleRef = useRef(forceScramble || 0);
    // Mirrors activeCipher for the async paths, which must not read render values.
    const cipherRef = useRef(activeCipher);

    useEffect(() => {
        cipherRef.current = activeCipher;

        // A newly bought hint arrives as a new mask; adopt it unless a scramble
        // is currently showing, which owns the view until it settles.
        if (cipherText && !visible && !scrambleItems) {
            setDisplay(cipherText);
        }
    }, [activeCipher, cipherText, visible, scrambleItems]);

    const guessesKey = guesses.join(',');

    useEffect(() => {
        // The initial value is already correct; animating it would flash.
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        let cancelled = false;

        const run = async () => {
            const target = visible ? text : (cipherText || cipherRef.current);
            const textChars = [...text];

            // Solved: drop the scramble view and show the answer.
            if (visible && scrambleItems) {
                setScrambleItems(null);
                setDisplay(text);
                return;
            }

            const isForced = Boolean(forceScramble && forceScramble > lastForceScrambleRef.current);
            if (isForced) lastForceScrambleRef.current = forceScramble!;

            if (display === target && !scrambleItems && !isForced) return;

            if (!visible && (hintLevel >= 2 || isForced)) {
                await runScramble({ textChars, target });
                return;
            }

            await runMorph({ textChars, target, start: display });
        };

        const runScramble = async ({ textChars, target }: { textChars: string[]; target: string }) => {
            const shuffles = Math.floor(Math.random() * 5) + 2;
            const interval = SCRAMBLE_DURATION_MS / shuffles;

            const baseItems = buildScrambleItems({
                textChars,
                cipherChars: [...activeCipher],
                guessState: computeGuessState(text, guesses),
                hintLevel,
            });

            setScrambleItems(generateShuffledView(baseItems));

            for (let i = 0; i < shuffles; i++) {
                if (cancelled) return;
                await wait(interval);
                if (cancelled) return;

                setScrambleItems((prev) => generateShuffledView(prev ?? baseItems));
            }

            await wait(SETTLE_MS);
            if (cancelled) return;

            // From level 2 the scramble *is* the resting state; below it, resolve.
            if (!visible && hintLevel >= 2) return;
            setDisplay(target);
            setScrambleItems(null);
        };

        const runMorph = async (
            { textChars, target, start }: { textChars: string[]; target: string; start: string },
        ) => {
            if (scrambleItems) return;

            const steps = Math.max(textChars.length, [...cipherRef.current].length);
            const stepDuration = Math.max(MORPH_MIN_MS, Math.min(MORPH_MAX_MS, MORPH_TOTAL_MS / steps));

            for (let i = 0; i <= steps; i++) {
                if (cancelled) return;

                // Sliced by code point so astral glyphs are never split in half.
                if (visible) {
                    setDisplay(textChars.slice(0, i).join('') + [...cipherRef.current].slice(i).join(''));
                } else {
                    setDisplay([...target].slice(0, i).join('') + [...start].slice(i).join(''));
                }

                await wait(stepDuration);
            }

            if (!cancelled) setDisplay(target);
        };

        run();
        return () => { cancelled = true; };
        // `display` and `scrambleItems` are read as the animation's starting point,
        // not tracked — including them would restart the animation on every frame.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, text, cipherText, hintLevel, forceScramble, guessesKey]);

    return { display, scrambleItems };
}
