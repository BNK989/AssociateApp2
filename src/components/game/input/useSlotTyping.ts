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
    typeableCapacity,
    type CaretMode,
} from '@/lib/letterPool/slotRules';
import { resolveTyping } from '@/lib/letterPool/readingRules';
import type { PoolLetter } from '@/lib/letterPool/poolRules';
import type { Slot } from '@/lib/letterPool/slotRules';

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
    /**
     * Positions the settle drip has placed on this word.
     *
     * Arrives as an array rather than a set because it lives on the message and
     * is persisted with it; the memo below turns it into the set the rules want,
     * keyed on its contents so a new letter landing re-solves the strip.
     */
    settled?: number[];
    /**
     * The position a settling letter is flying to, while it is in the air.
     *
     * Deliberately *not* in `settled`. A settled letter counts as placed, which
     * takes it out of the pool and unmounts its halo chip — and a chip that has
     * unmounted has no rectangle to fly from. Binding it here instead keeps the
     * letter in the pool and hands its slot to `resolvePlacements`, which is
     * exactly the state a typed placement is in: `useLetterFlights` sees a pool
     * id arrive in a slot and launches, with no idea the game rather than the
     * player put it there.
     */
    pendingSettle?: number | null;
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
 * The animation does not need the events either. `useLetterFlights` watches the
 * placements this produces and launches a flight when one appears, so nothing
 * here has to fire, sequence or clean up an animation — a letter that is placed
 * twice is simply placed twice, and the flight follows.
 */
export function useSlotTyping({
    text, guesses, mode, mask, settled, pendingSettle, targetId, setInput,
}: UseSlotTypingArgs) {
    const [typed, setTyped] = useState('');

    // Clearing on a new word and on a recorded guess covers every reset: the
    // parent's own `setInput('')` calls all happen at one of those two moments.
    // A settled letter changes which slots are open, so the keystrokes typed
    // against the old arrangement no longer mean what they meant. Clearing is
    // the honest answer: re-mapping them would silently move letters the player
    // is looking at, which is the jump `readingRules` documents at length.
    const guessCount = guesses.length;
    const resetKey = `${targetId ?? ''}:${guessCount}:${settled?.length ?? 0}`;
    const lastResetKey = useRef(resetKey);
    if (lastResetKey.current !== resetKey) {
        lastResetKey.current = resetKey;
        if (typed !== '') setTyped('');
    }

    const guessKey = guesses.join(',');
    const settledKey = settled?.join(',') ?? '';
    const model = useMemo(() => {
        if (!text) return null;

        const placedBySettle = new Set(settled ?? []);
        const pool = buildLetterPool(
            text, guesses, [], mask, `pool-${targetId ?? 'word'}`, placedBySettle,
        );

        // Which habit the player is typing in, decided from the keystrokes
        // rather than from a mode they were never told they were in.
        const typing = resolveTyping({ text, guesses, typed, mode, mask, settled: placedBySettle });
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
            settled: placedBySettle,
        });
        // The letter in the air, bound to the slot it is heading for. Done after
        // the strip is built so it cannot disturb the reading of what the
        // player typed: it fills a slot that was open and touches nothing else.
        const flying = pendingSettle != null
            ? bindPending(slots, placements, pool, pendingSettle, `pool-${targetId ?? 'word'}`)
            : null;

        const groups = groupSlots(slots);

        return {
            pool,
            slots,
            groups,
            placements,
            reading: typing.reading,
            longest: longestGroupLength(groups),
            placed: new Set<string>(placements.keys()),
            /** Pool id of the letter in the air, if any. */
            flyingId: flying,
            caretIndex: typing.caretIndex,
            attempt: typing.attempt,
            // The field accepts as much as the longer reading can hold, or the
            // whole-word reading could never be reached to be evaluated.
            capacity: typeableCapacity(text),
        };
        // guessKey and settledKey stand in for the arrays, whose identities
        // change every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        text, guessKey, settledKey, pendingSettle, typed,
        mode, mask?.cipher, mask?.hintLevel, targetId,
    ]);

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

/**
 * Binds a settling letter to the slot it is flying to, in place.
 *
 * Mutates the arrays it is handed, which are freshly built one line above and
 * belong to nobody else yet. Returns the pool id so the composer can recognise
 * that letter's flight and report the landing back.
 *
 * Nothing happens if the pool has no letter for that position: the drip only
 * ever chooses from the pool, so that means the board moved underneath the
 * flight, and drawing a letter the pool cannot account for is the one outcome
 * worth refusing outright.
 */
function bindPending(
    slots: Slot[],
    placements: Map<string, number>,
    pool: PoolLetter[],
    index: number,
    idPrefix: string,
): string | null {
    const poolId = `${idPrefix}-${index}`;
    const letter = pool.find((entry) => entry.id === poolId);
    const slot = slots.find((entry) => entry.index === index);

    if (!letter || !slot || slot.kind !== 'open') return null;

    placements.set(poolId, index);
    slot.char = letter.char;
    slot.poolId = poolId;

    return poolId;
}
