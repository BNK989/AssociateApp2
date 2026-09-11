import { isGapChar, placedIndices, type MaskState, type PoolLetter } from './poolRules';

/**
 * The composer's slot strip: what each cell is showing, how a typed string
 * maps onto the cells, and how a phrase is grouped so it can wrap.
 *
 * Split from `poolRules` at the seam between the two halves of the gesture —
 * the pool knows which letters have no place, the strip knows where places
 * are. The binding between them (`resolvePlacements`) lives here because it
 * is the half that needs to know about slots.
 */

/**
 * One cell of the composer's strip.
 *
 * - `gap`: scenery the player is given — a space, a hyphen, an apostrophe.
 *   Never typed into, and it is what phrases wrap between.
 * - `green`: confirmed in place.
 * - `open`: the player's to fill.
 */
export type SlotKind = 'gap' | 'green' | 'open';

export interface Slot {
    kind: SlotKind;
    /** Index into the answer, by code point. */
    index: number;
    /** What the cell is showing, or null for an empty open slot. */
    char: string | null;
    /** Set on an open slot filled by a letter drawn out of the pool. */
    poolId?: string;
    /**
     * Set in `full` mode when the player typed something over a green slot that
     * disagrees with it. Never blocks the keystroke — it only marks the cell.
     */
    conflict?: boolean;
}

/** A run of slots with no gap in it — one word of the answer. */
export interface SlotGroup {
    slots: Slot[];
    /** The gap that followed this group, if any, so the strip can draw it. */
    trailing: Slot | null;
}

/**
 * How a typed string maps onto the strip.
 *
 * `skip` treats greens as given: the caret jumps over them and the player types
 * only the gaps, never retyping a letter they already earned. `full` is the
 * familiar word-game shape — you type the whole answer and greens act as
 * checkpoints that mark a disagreement.
 *
 * Which one applies is a game-master setting, so this takes it as an argument
 * rather than reading it.
 */
export type CaretMode = 'skip' | 'full';

/** Indices the player types into, in order, under the given caret mode. */
export function typeableIndices(text: string, placed: Set<number>, mode: CaretMode): number[] {
    return [...text].flatMap((char, index) => {
        if (isGapChar(char)) return [];
        if (mode === 'skip' && placed.has(index)) return [];
        return [index];
    });
}

type BuildSlotsArgs = {
    text: string;
    guesses: string[];
    /** What the player has typed, in the order they typed it. */
    typed: string;
    mode: CaretMode;
    /** Where each pool letter has been placed, by pool id. */
    placements?: Map<string, number>;
    /** The server's mask, which can confirm positions of its own. */
    mask?: MaskState;
};

/**
 * The strip the composer draws.
 *
 * Greens are filled from the answer whether or not the player has typed them,
 * because they are earned. Everything else comes from `typed`, mapped onto the
 * typeable indices in order — so in `skip` mode the third character typed lands
 * in the third *open* slot, not the third slot.
 */
export function buildSlots({ text, guesses, typed, mode, placements, mask }: BuildSlotsArgs): Slot[] {
    const placed = placedIndices(text, guesses, mask);
    const chars = [...text];
    const typeable = typeableIndices(text, placed, mode);
    const typedChars = [...typed];

    const typedAt = new Map<number, string>();
    typedChars.forEach((char, position) => {
        const index = typeable[position];
        if (index !== undefined) typedAt.set(index, char);
    });

    const poolAt = new Map<number, string>();
    placements?.forEach((slotIndex, poolId) => poolAt.set(slotIndex, poolId));

    return chars.map((char, index) => {
        if (isGapChar(char)) {
            return { kind: 'gap' as const, index, char };
        }

        const isGreen = placed.has(index);
        const typedChar = typedAt.get(index);

        if (isGreen && mode === 'skip') {
            return { kind: 'green' as const, index, char };
        }

        if (isGreen) {
            // `full` mode: the green is shown until the player types over it,
            // and a disagreement is marked rather than rejected.
            if (typedChar === undefined) return { kind: 'green' as const, index, char };
            const conflict = typedChar.toLowerCase() !== char.toLowerCase();
            return { kind: 'green' as const, index, char: typedChar, conflict };
        }

        const poolId = poolAt.get(index);
        return {
            kind: 'open' as const,
            index,
            char: typedChar ?? null,
            ...(typedChar !== undefined && poolId ? { poolId } : {}),
        };
    });
}

/**
 * The answer as the strip currently reads, or null while any slot is empty.
 *
 * Null is what disables submit: a strip is either a complete attempt or not an
 * attempt at all, which is also why there is no separate length check.
 */
export function assembleAttempt(slots: Slot[]): string | null {
    let out = '';
    for (const slot of slots) {
        if (slot.kind === 'gap') { out += slot.char ?? ''; continue; }
        if (!slot.char) return null;
        out += slot.char;
    }
    return out;
}

/**
 * Slots split into the words the strip wraps between.
 *
 * A phrase wraps at its spaces, so each word stays whole on one line. The gap
 * itself is carried on the group before it rather than being a cell of its own:
 * a space rendered as a slot is an empty box the player tries to type into.
 */
export function groupSlots(slots: Slot[]): SlotGroup[] {
    const groups: SlotGroup[] = [];
    let current: Slot[] = [];

    for (const slot of slots) {
        if (slot.kind === 'gap' && slot.char === ' ') {
            groups.push({ slots: current, trailing: slot });
            current = [];
            continue;
        }
        current.push(slot);
    }

    if (current.length > 0) groups.push({ slots: current, trailing: null });
    return groups.filter((group) => group.slots.length > 0 || group.trailing);
}

/**
 * The widest group, which is what slot width is sized against.
 *
 * Sizing to the longest *word* rather than the whole answer is what keeps a
 * phrase legible: "MORNING GLORY" wraps to two lines of full-size slots instead
 * of thirteen cramped ones on one line.
 */
export function longestGroupLength(groups: SlotGroup[]): number {
    return groups.reduce((widest, group) => Math.max(widest, group.slots.length), 1);
}

/**
 * Re-binds the pool to a typed string from scratch.
 *
 * Used whenever the edit was not a simple append or delete — a paste, a caret
 * moved into the middle, a new guess landing and changing which slots are open.
 * Appends and deletes are handled incrementally by the caller so that a single
 * tile can be animated; this is the correctness backstop under it.
 */
export function resolvePlacements(
    pool: PoolLetter[],
    slots: Slot[],
): Map<string, number> {
    const placements = new Map<string, number>();
    const spent = new Set<string>();

    for (const slot of slots) {
        if (slot.kind !== 'open' || !slot.char) continue;
        const match = pool.find(
            (letter) => !spent.has(letter.id) && letter.char.toLowerCase() === slot.char!.toLowerCase(),
        );
        if (!match) continue;
        spent.add(match.id);
        placements.set(match.id, slot.index);
    }

    return placements;
}

