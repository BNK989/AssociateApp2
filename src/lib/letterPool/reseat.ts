import type { Slot } from './slotRules';

/**
 * What the player's keystrokes become when a letter settles underneath them.
 *
 * The composer used to answer this by throwing them away. A settled letter
 * changes which slots are open, so the reasoning went, and the keystrokes typed
 * against the old arrangement no longer mean what they meant — better to clear
 * than to move letters the player is looking at.
 *
 * In play that is the worst of the three answers. The letters vanish from the
 * field with no explanation, at the exact moment the game claimed to be
 * helping, and the player loses work they did. Clearing is not honesty; it is
 * the game deciding their input was not worth keeping.
 *
 * Almost all of it is still valid, and the part that is not is knowable rather
 * than guessable:
 *
 * - Under the **whole-word** reading the keystrokes cover every typeable
 *   position, so a settled letter simply agrees with what is already there and
 *   nothing has to move at all.
 * - Under the **gaps** reading the keystrokes fill the open slots in order. One
 *   slot has just closed, so exactly one keystroke is redundant — the one that
 *   was sitting in it. Every other keystroke keeps the slot it had.
 *
 * So one character is dropped and the rest survive. Nothing is re-mapped onto a
 * slot it was not already in, which is the jump `readingRules` warns about.
 */

export type ReseatArgs = {
    /** The keystrokes as they stand. */
    typed: string;
    /** The strip as it was built *before* the letter settled. */
    slots: Slot[];
    /** Which reading those keystrokes were being read under. */
    reading: 'whole' | 'gaps';
    /** Positions now settled, the new arrival included. */
    settled: readonly number[];
};

export function reseatTyped({ typed, slots, reading, settled }: ReseatArgs): string {
    // Every typeable position already carries a keystroke, so a letter landing
    // in one of them confirms what is there rather than displacing it.
    if (reading === 'whole') return typed;

    const closed = new Set(settled);
    const chars = [...typed];
    const kept: string[] = [];

    // The open slots, in the order the keystrokes were read into them.
    let ordinal = 0;
    for (const slot of slots) {
        if (slot.kind !== 'open') continue;

        const char = chars[ordinal];
        ordinal += 1;

        if (char === undefined) break;
        // Its slot is no longer open: the settled letter is in it now.
        if (closed.has(slot.index)) continue;

        kept.push(char);
    }

    return kept.join('');
}
