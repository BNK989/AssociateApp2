import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { decodeFrame, decodeStepMs, decodeSteps, placeholderGlyphs } from '@/lib/clueDecode';

/**
 * A clue arriving the way everything else on this board arrives: masked, then
 * decoded.
 *
 * The glyphs are the same alphabet the bubbles are ciphered with, so the clue
 * reads as part of the game rather than as a notification the game received.
 * The decode is short by construction (`DECODE_BUDGET_MS`) — it is a flourish
 * in front of help the player is waiting for, and help that makes you wait is
 * not help.
 *
 * The animated string is `aria-hidden`; the label carries the settled text, so
 * a screen reader is never read a wall of alchemical signs.
 */
export function ClueText({ text }: { text: string }) {
    const reduced = Boolean(useReducedMotion());
    const steps = decodeSteps(text);

    const [revealed, setRevealed] = useState(0);
    const [frame, setFrame] = useState(0);

    useEffect(() => {
        if (reduced) return;

        const id = setInterval(() => {
            setFrame((f) => f + 1);
            setRevealed((r) => (r >= steps ? r : r + 1));
        }, decodeStepMs(steps));

        return () => clearInterval(id);
    }, [text, steps, reduced]);

    // Settled during render rather than by an effect: a player who has asked
    // for reduced motion wants the clue, not a shorter animation of it, and
    // reaching that state through a setState would flash one masked frame first.
    const legible = reduced ? steps : revealed;

    return (
        <span aria-label={text}>
            <span aria-hidden="true">{decodeFrame(text, legible, frame)}</span>
        </span>
    );
}

/** How many glyphs stand in for a clue still being fetched. */
const PLACEHOLDER_LENGTH = 22;

/** Frames per second of churn while waiting. Slow enough to read as breathing. */
const PLACEHOLDER_STEP_MS = 90;

/**
 * The clue's place held while it is on its way.
 *
 * Same glyphs, never resolving — the shape of an answer that has not landed.
 * It replaces three bouncing dots and the words "Consulting AI", which told the
 * player something about the plumbing and nothing about the game.
 */
export function ClueSkeleton() {
    const reduced = Boolean(useReducedMotion());
    const [frame, setFrame] = useState(0);

    useEffect(() => {
        if (reduced) return;

        const id = setInterval(() => setFrame((f) => f + 1), PLACEHOLDER_STEP_MS);
        return () => clearInterval(id);
    }, [reduced]);

    return (
        <span aria-hidden="true" className="opacity-60">
            {placeholderGlyphs(PLACEHOLDER_LENGTH, frame)}
        </span>
    );
}
