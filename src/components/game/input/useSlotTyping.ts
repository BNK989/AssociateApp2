import { useEffect, useMemo, useRef, useState } from 'react';
import {
    buildLetterPool,
    type MaskState,
} from '@/lib/letterPool/poolRules';
import {
    buildSlots,
    groupSlots,
    longestGroupLength,
    normaliseTyped,
    resolvePlacements,
    resolveTyping,
    typeableCapacity,
    type CaretMode,
} from '@/lib/letterPool/slotRules';

type UseSlotTypingArgs = {
    /** The answer being solved. Absent when there is nothing to solve. */
    text: string | null;
    guesses: string[];
    mode: CaretMode;
    /**
     * The server's mask. It confirms positions of its own below hint 2, and
     * from hint 2 its anagram is where a purchased hint's letters come from —
     * without it, buying one would reveal nothing once those letters left the
     * word line.
     */
    mask?: MaskState;
    /** Identifies the word, so the strip clears when a new one comes up. */
    targetId: string | undefined;
    /**
     * The parent's guess value, which is what gets submitted. Set to the
     * assembled attempt once the strip is full, and to empty while it is not —
     * so "the strip is complete" and "submit is enabled" are the same fact.
     */
    setInput: (value: string) => void;
};

/**
 * Binds what the player types to the slot strip and the letter pool.
 *
 * Everything here is derived, not stepped: given the answer, the guesses so far
 * and the typed string, there is exactly one correct arrangement of pool and
 * strip, and it is recomputed rather than patched. That matters for more than
 * tidiness — a paste, a caret dropped into the middle of the string, or a new
 * guess arriving and turning an orange letter green all land on the same path
 * as an ordinary keystroke, instead of each needing its own handling.
 *
 * The animation does not need the events either. A letter moves because it is
 * rendered somewhere new and framer matches it by `layoutId`, so there is no
 * imperative flight to keep in step with state, and nothing to get stuck
 * mid-air if a re-render interrupts it.
 */
export function useSlotTyping({ text, guesses, mode, mask, targetId, setInput }: UseSlotTypingArgs) {
    const [typed, setTyped] = useState('');

    // Clearing on a new word and on a recorded guess covers every reset: the
    // parent's own `setInput('')` calls all happen at one of those two moments.
    const guessCount = guesses.length;
    const resetKey = `${targetId ?? ''}:${guessCount}`;
    const lastResetKey = useRef(resetKey);
    if (lastResetKey.current !== resetKey) {
        lastResetKey.current = resetKey;
        if (typed !== '') setTyped('');
    }

    const guessKey = guesses.join(',');
    const model = useMemo(() => {
        if (!text) return null;

        const pool = buildLetterPool(text, guesses, [], mask, `pool-${targetId ?? 'word'}`);

        // Which habit the player is typing in, decided from the keystrokes
        // rather than from a mode they were never told they were in.
        const typing = resolveTyping({ text, guesses, typed, mode, mask });
        const placements = resolvePlacements(pool, typing.slots);

        // Re-read under the settled reading so the cells know which letters came
        // out of the pool, and therefore which ones fly.
        const slots = buildSlots({
            text,
            guesses,
            typed,
            mode: typing.reading === 'whole' ? 'full' : 'skip',
            placements,
            mask,
        });
        const groups = groupSlots(slots);

        return {
            pool,
            slots,
            groups,
            placements,
            reading: typing.reading,
            longest: longestGroupLength(groups),
            placed: new Set<string>(placements.keys()),
            caretIndex: typing.caretIndex,
            attempt: typing.attempt,
            // The field accepts as much as the longer reading can hold, or the
            // whole-word reading could never be reached to be evaluated.
            capacity: typeableCapacity(text),
        };
        // guessKey stands in for the array, whose identity changes every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, guessKey, typed, mode, mask?.cipher, mask?.hintLevel, targetId]);

    // The parent submits `input`, so it carries the assembled answer rather
    // than the keystrokes: in skip mode those are only the gaps between greens.
    //
    // Guarded on the strip being up. Without the guard this claimed ownership of
    // `input` even when there was no word to solve, and blanked it on mount —
    // which is the composer during the chain phase, where the player is typing
    // an ordinary message and nothing here should touch it.
    const attempt = model?.attempt ?? null;
    const active = Boolean(model);
    useEffect(() => {
        if (!active) return;
        setInput(attempt ?? '');
        // setInput is a setState from the parent and is stable.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attempt, active]);

    /** What the strip would keep of a raw field value. */
    const normalise = (value: string) => normaliseTyped(value, model?.capacity ?? 0);

    /** Accepts a raw field value, keeping only what the strip can hold. */
    const onTypedChange = (value: string) => {
        if (!model) return;
        setTyped(normalise(value));
    };

    return { typed, onTypedChange, normalise, model };
}
