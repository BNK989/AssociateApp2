import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
    decodeStepMs,
    decodeSteps,
    maskWord,
    placeholderGlyphs,
    splitClue,
} from '@/lib/clueDecode';

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
 * ## The text never moves while it decodes
 *
 * Each word is laid out **at the width of its own finished text**: the real
 * word is always in the flow, hidden with `invisible` while it is still masked,
 * and the glyphs are painted over it out of flow. So the line breaks, the line
 * count and the height of the panel are all decided once, by the clue, and the
 * decode cannot change any of them.
 *
 * It used to reflow the whole way down. A masked clue was about 1.7x the width
 * of the clue it hid (see `clueDecode.ts` for the measurements), which on a
 * phone meant two extra lines that were then dropped one at a time as the text
 * resolved — the panel shrinking under the player while they read it.
 *
 * The animated string is `aria-hidden`; the label carries the settled text, so
 * a screen reader is never read a wall of alchemical signs.
 */
export function ClueText({ text }: { text: string }) {
    const reduced = Boolean(useReducedMotion());
    const steps = decodeSteps(text);
    const segments = useMemo(() => splitClue(text), [text]);

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
            <span aria-hidden="true">
                {segments.map((segment) => segment.kind === 'gap' ? (
                    <span key={segment.start}>{segment.text}</span>
                ) : (
                    <ClueWord
                        key={segment.start}
                        word={segment.text}
                        revealed={legible - segment.start}
                        frame={frame}
                        offset={segment.start}
                    />
                ))}
            </span>
        </span>
    );
}

/**
 * One word of the clue, in a box the size of the word.
 *
 * The mask sits in an absolutely positioned overlay rather than in the flow, so
 * a frame whose glyphs run a few pixels over the word's width spills into the
 * space beside it instead of pushing the rest of the line along. `inset-0`
 * rather than a flex centring: the overlay then shares the box's line box, so
 * the characters already decoded sit on exactly the baseline they will keep
 * once the word finishes and the overlay goes away.
 */
function ClueWord({
    word,
    revealed,
    frame,
    offset,
}: {
    word: string;
    revealed: number;
    frame: number;
    offset: number;
}) {
    const done = revealed >= Array.from(word).length;

    return (
        <span className="relative inline-block">
            <span className={done ? undefined : 'invisible'}>{word}</span>

            {!done && (
                <span className="absolute inset-0 whitespace-nowrap">
                    {maskWord(word, revealed, frame, offset)}
                </span>
            )}
        </span>
    );
}

/**
 * How many glyphs stand in for a clue still being fetched.
 *
 * One short line, not the 22 glyphs it used to be: at ~0.88em each those ran
 * to two lines in a narrow bubble, so the panel opened tall and then jumped
 * again when the real clue replaced them.
 */
const PLACEHOLDER_LENGTH = 10;

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
        <span aria-hidden="true" className="whitespace-nowrap opacity-60">
            {placeholderGlyphs(PLACEHOLDER_LENGTH, frame)}
        </span>
    );
}
