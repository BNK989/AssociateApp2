import {
    assembleAttempt,
    buildSlots,
    typeableCapacity,
    typeableIndices,
    type BuildSlotsArgs,
    type CaretMode,
    type Slot,
} from './slotRules';
import { placedIndices } from './poolRules';

/**
 * Reading the keystrokes: which of the two typing habits the player is in, and
 * therefore which arrangement of the strip they are looking at.
 *
 * Split from `slotRules`, which knows how to draw an arrangement but not which
 * one to draw. This is the half that has to reason about the player.
 */

/** Which reading of the typed string the strip settled on. */
export type Reading = 'gaps' | 'whole';

export interface Typing {
    slots: Slot[];
    reading: Reading;
    /** The answer as the strip reads, or null while a slot is empty. */
    attempt: string | null;
    /** The next cell a keystroke fills, or null when the strip is full. */
    caretIndex: number | null;
}

function firstEmpty(slots: Slot[]): number | null {
    const empty = slots.find((slot) => slot.kind !== 'gap' && !slot.char);
    return empty ? empty.index : null;
}

/**
 * Decides what the player meant by what they typed.
 *
 * Two habits have to work without the player knowing which one they are in.
 * Given `S_m___` for SAMPLE, one person types `sample` and another types
 * `aple`, and both are right. The composer cannot ask the answer which it is
 * looking at — that would be reading the very thing it is hiding — so it reads
 * only what the player can already see: the letters it has given them, and how
 * many slots there are.
 *
 * That turns out to be enough, because the two readings fail in different ways.
 *
 * - **gaps**: every character goes to the next *open* slot. Dies by overflowing.
 * - **whole**: every character goes to the next slot of any kind, so a character
 *   landing on a given letter has to match it. Dies on a disagreement.
 *
 * Typing `sample` overflows the four open slots, so only *whole* survives.
 * Typing `aple` disagrees with the given `S`, so only *gaps* does.
 *
 * **It is read over the keystrokes, not over the final string.** The reading
 * starts as *whole* — typing the answer out is much the commoner habit — and
 * changes only at a keystroke that makes the current reading impossible. A
 * reading that is still alive is never abandoned, however tempting the other
 * one looks, because abandoning it re-arranges letters the player is looking at:
 * with `PU___Y` up for PULLEY, the third keystroke of `pulley` fills the three
 * open slots under *gaps*, and the strip used to jump to `PUPULY` — every
 * letter but the typed one moved, mid-word, on a correct keystroke.
 *
 * That jump was the cost of a "whichever reading fills the strip wins" tiebreak.
 * It fired for every player typing a word out in full the moment they had typed
 * as many letters as there were open slots, which on a word with several
 * confirmed letters is long before they are finished — the common case — and it
 * bought only the narrow one below.
 *
 * **The one rough edge, stated plainly.** A word whose first letter repeats —
 * OOZE, LLAMA, AARDVARK — is the shape where neither reading can be ruled out:
 * `oze` is a finished *gaps* reading and an unfinished *whole* one, and nothing
 * the player can see separates them. *whole* stays up, so a player who skips on
 * such a word is left one cell short and has to clear the field and type the
 * word out. That is a dead end they can see and back out of; the jump was not.
 *
 * If neither reading survives — a typo over a confirmed letter — *whole* is
 * shown with the disagreement marked, because a player who has mistyped is
 * better served seeing where than seeing nothing.
 */
export function resolveTyping(
    { text, guesses, typed, mode, mask, settled }: Omit<BuildSlotsArgs, 'placements'>,
): Typing {
    const build = (as: CaretMode) => buildSlots({ text, guesses, typed, mode: as, mask, settled });

    const whole = build('full');

    // The setting can pin the composer to one reading; then there is nothing
    // to decide and a disagreement is simply marked.
    if (mode === 'full') {
        return {
            slots: whole,
            reading: 'whole',
            attempt: assembleAttempt(whole),
            caretIndex: firstEmpty(whole),
        };
    }

    const gaps = build('skip');
    const chosen = readKeystrokes({
        typedLength: [...typed].length,
        capacity: typeableCapacity(text),
        openCount: typeableIndices(text, placedIndices(text, guesses, mask, settled), 'skip').length,
        conflictAt: firstConflictPosition(text, whole),
    });

    const slots = chosen === 'whole' ? whole : gaps;

    return {
        slots,
        reading: chosen,
        attempt: assembleAttempt(slots),
        caretIndex: firstEmpty(slots),
    };
}

/**
 * Where the *whole* reading dies: the position in the typed string of the first
 * character that disagrees with a letter the player was given, or `Infinity` if
 * none does.
 *
 * A position rather than a boolean, because the reading is settled over the
 * keystrokes: a disagreement at the fifth character says nothing about what the
 * first four meant. It can be read once from the full string because *whole*
 * maps every character to the same slot whatever comes after it.
 */
function firstConflictPosition(text: string, whole: Slot[]): number {
    const typeable = typeableIndices(text, new Set(), 'full');
    const at = typeable.findIndex((index) => whole[index]?.conflict);
    return at === -1 ? Infinity : at;
}

type Survival = {
    typedLength: number;
    /** Slots the *whole* reading can hold. */
    capacity: number;
    /** Slots the *gaps* reading can hold. */
    openCount: number;
    /** Typed position at which *whole* first disagrees with a given letter. */
    conflictAt: number;
};

/**
 * The reading, settled one keystroke at a time.
 *
 * Both readings are monotone — a reading that cannot explain the first `k`
 * characters cannot explain the first `k + 1` either — so the walk is over the
 * two lengths at which each one dies rather than over the string itself.
 */
function readKeystrokes({ typedLength, capacity, openCount, conflictAt }: Survival): Reading {
    const alive = (reading: Reading, length: number) => (
        reading === 'whole'
            ? length <= capacity && length <= conflictAt
            : length <= openCount
    );

    let reading: Reading = 'whole';
    for (let length = 1; length <= typedLength; length += 1) {
        if (alive(reading, length)) continue;
        const other: Reading = reading === 'whole' ? 'gaps' : 'whole';
        // Neither reading explains this keystroke, so it is a mistake rather
        // than a habit: fall back to *whole*, which is the one that can show
        // the player where they went wrong.
        reading = alive(other, length) ? other : 'whole';
    }

    return reading;
}
