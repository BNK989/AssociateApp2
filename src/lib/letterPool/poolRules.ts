import { computeGuessState, isFillerChar } from '@/components/cipher/cipherRules';

/**
 * The rules behind the letter pool: which letters are known but unplaced, what
 * the composer's slot strip is showing, and how a typed string binds to both.
 *
 * Pure and tested, for the same reason `cipherRules` is: this decides what the
 * player is allowed to see, and that must not be tangled up with animation.
 *
 * The problem it exists to solve: an orange letter drawn inside a line of text
 * is read as being *at* that spot, because a line of text means sequence. No
 * amount of colour, tilt or drift beats that. So known-but-unplaced letters
 * leave the line entirely and live in a pool, and the player places them by
 * typing. See `knowledge base/letter_feedback.md`.
 */

/**
 * Whether the composer is supplying the answer's shape for this word.
 *
 * One predicate, read by the composer to decide whether to draw the strip and
 * by the solve path to decide whether to compare exactly. They must agree: if
 * the strip filled letters in, those letters must not be allowed to count
 * towards a fuzzy match. Gated behind the same disclosure rule the
 * `typed / total` counter had, so it never reveals a length earlier than before.
 */
export function stripSuppliesShape(
    { enabled, hintLevel, isSinglePlayer }:
    { enabled: boolean; hintLevel: number; isSinglePlayer: boolean },
): boolean {
    return enabled && (isSinglePlayer || hintLevel >= 1);
}

/** A letter the player has found but not yet pinned to a position. */
export interface PoolLetter {
    /**
     * Stable across rebuilds so a tile keeps its identity, tilt and animation —
     * and distinct *between* words, which is why the caller passes a prefix.
     * Keyed on position alone, the second word's tiles inherited the first
     * word's elements: React saw the same keys, swapped the characters in
     * place, and no tile ever animated in.
     */
    id: string;
    char: string;
    /** The slot it is currently placed in, or null while it is still adrift. */
    slotIndex: number | null;
}

/**
 * A character the player is never asked to type.
 *
 * Spaces are the obvious case. Punctuation is given for the same reason: the
 * strip already discloses the answer's length, so its shape is not new
 * information, and asking a player to guess where an apostrophe falls tests
 * typing rather than the association.
 */
export function isGapChar(char: string): boolean {
    return !/\p{L}|\p{N}/u.test(char);
}

/**
 * The letters the player has found but not placed — one tile per occurrence.
 *
 * `revealedChars` is a set of *characters*, so it cannot say how many of a
 * letter the answer holds. Counting occurrences here is what lets BANANA show
 * three A's rather than one, and it reveals nothing new: the same count is
 * already on screen, because `buildScrambleItems`' letter budget draws every
 * unclaimed occurrence.
 *
 * A green occurrence is not in the pool — it has a place, which is the whole
 * distinction the pool exists to draw.
 *
 * The result is returned in a seeded order that is not the answer's — see
 * `scramblePool`, which is the other half of that same distinction.
 */
export function buildLetterPool(
    text: string,
    guesses: string[],
    previous: PoolLetter[] = [],
    mask?: MaskState,
    idPrefix = 'pool',
): PoolLetter[] {
    const { revealedChars } = computeGuessState(text, guesses);
    const placed = placedIndices(text, guesses, mask);
    const held = new Map(previous.map((letter) => [letter.id, letter]));

    // What the anagram mask exposes, as a budget to spend. Without this a hint
    // bought at level 2 would reveal nothing at all: its letters no longer
    // appear in the line, so the pool is the only place left for them to go.
    const fromMask: Record<string, number> = {};
    if (mask && mask.hintLevel >= 2) {
        for (const char of [...mask.cipher]) {
            if (char === ' ' || isFillerChar(char)) continue;
            const lower = char.toLowerCase();
            fromMask[lower] = (fromMask[lower] || 0) + 1;
        }
    }

    const found = [...text].flatMap((char, index) => {
        if (placed.has(index) || isGapChar(char)) return [];

        const lower = char.toLowerCase();
        const guessed = revealedChars.has(lower);

        // A guess reveals every occurrence of its letter; the mask reveals only
        // as many as it actually shows, so that budget is spent down.
        if (!guessed) {
            if ((fromMask[lower] || 0) <= 0) return [];
            fromMask[lower] -= 1;
        }

        const id = `${idPrefix}-${index}`;
        return [{ id, char, slotIndex: held.get(id)?.slotIndex ?? null }];
    });

    return scramblePool(found);
}

/**
 * A tile's seed, derived from its own id. Its place in the pool, its tilt, its
 * lift and the gap in front of it are all drawn from this one number, so every
 * scattered property of a tile moves with its identity rather than its slot.
 *
 * FNV-1a **plus a final avalanche**, and the second half is not optional. Tile
 * ids differ only in their last character — `…-4`, `…-5` — and a bare
 * accumulate-and-multiply turns a delta of one into a delta of one prime: the
 * eight keys of an eight-letter word come out as `base + n * prime`, whose sort
 * order is one cyclic sequence rotated. Measured before this mix was added,
 * `starling` scrambled to `gnilrats` — its exact reverse — and two different
 * words drew the identical order. The murmur3 finaliser diffuses the low bits
 * across all 32, which is what makes the permutation actually depend on the
 * word.
 */
export function seedFromId(id: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < id.length; i++) {
        hash ^= id.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }

    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b) >>> 0;
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
    return (hash ^ (hash >>> 16)) >>> 0;
}

/**
 * The pool's display order: seeded, and deliberately not the answer's.
 *
 * Built in text order, the pool re-asserted the one thing the pool exists to
 * deny. Every tile individually claims nothing about position — but a row of
 * them left to right is a sequence, and a player can read the remaining letters
 * off in order and type them without ever recalling the word. From hint level 2
 * it was worse than a hint: the server's mask is an *anagram* there, and
 * building the pool by walking `text` sorted that anagram back into the answer,
 * handing over more than the hint was sold as.
 *
 * Two properties make the order safe to look at:
 *
 * - **Keyed on the full id, which carries the word.** A permutation seeded on
 *   the index alone is the same permutation for every word of that length, so a
 *   player who learns it once can invert it forever. Same class of mistake as
 *   `tiltSeed` keying off a slot.
 * - **Stable under insertion.** A sort by per-tile key leaves the existing
 *   tiles' relative order alone when a newly found letter arrives. A seeded
 *   Fisher-Yates over the array would re-roll the whole pool on every reveal
 *   and make every tile jump, which is the twitching this codebase has now
 *   fixed twice.
 */
export function scramblePool(letters: PoolLetter[]): PoolLetter[] {
    return [...letters].sort(
        (a, b) => seedFromId(a.id) - seedFromId(b.id) || (a.id < b.id ? -1 : 1),
    );
}

/**
 * What the server's mask is currently disclosing.
 *
 * Below hint 2 the mask is built position by position, so a letter in it is at
 * its true index and counts as placed. From hint 2 the mask is an anagram: its
 * letters belong to the answer but their slots mean nothing, so they are known
 * without being placed — which is exactly what the pool is for.
 */
export interface MaskState {
    cipher: string;
    hintLevel: number;
}

/**
 * Positions the player has been given, from any source.
 *
 * Greens are the obvious ones. The mask's own positional reveals below hint 2
 * belong here too: the word line already draws them as confirmed, so the strip
 * must fill them in rather than ask the player to type a letter the board is
 * showing them as settled.
 */
export function placedIndices(text: string, guesses: string[], mask?: MaskState): Set<number> {
    const { greenIndices } = computeGuessState(text, guesses);
    const placed = new Set(greenIndices);

    if (!mask) return placed;

    // Hint level 1 buys the first letter at every level above it too, so the
    // strip fills it in rather than asking for a letter the player has paid for.
    const chars = [...text];
    if (mask.hintLevel >= 1 && chars.length > 0 && !isGapChar(chars[0])) {
        placed.add(0);
    }

    if (mask.hintLevel < 2) {
        const cipherChars = [...mask.cipher];
        chars.forEach((char, index) => {
            if (isGapChar(char)) return;
            const maskChar = cipherChars[index];
            if (maskChar === undefined || maskChar === ' ' || isFillerChar(maskChar)) return;
            placed.add(index);
        });
    }

    return placed;
}

/** The pool letter a newly typed character should draw out, if any. */
export function nextPoolMatch(
    pool: PoolLetter[],
    placements: Map<string, number>,
    char: string,
): PoolLetter | undefined {
    return pool.find(
        (letter) => !placements.has(letter.id) && letter.char.toLowerCase() === char.toLowerCase(),
    );
}
