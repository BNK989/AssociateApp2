import type { PoolLetter } from './poolRules';

/**
 * Every letter the halo has had to place for this word, in the order it first
 * had to place them.
 *
 * `layoutHalo` divides each edge into one band per letter and hands them out by
 * position in the list it is given. That is fine for a set that never changes
 * and wrong for the pool, which shrinks every time a letter finds its place:
 * the list closes up, every letter behind the departing one moves up a band,
 * and the whole halo re-solves. Because the chips keep their identity across
 * that re-solve, the browser animates it — so placing one letter sent all the
 * others flying to each other's spots, and since they are different letters it
 * read as them turning into one another.
 *
 * That is worse than untidy. A player mid-word is holding a picture of which
 * letters they have and roughly where; reshuffling it is the game undoing the
 * thinking it just helped with.
 *
 * So the layout is solved against this list rather than the live pool. A letter
 * keeps its spot for as long as the word is in play, a letter that leaves
 * leaves a gap behind it, and nothing else moves. The gap is not a blemish —
 * it is the only honest mark of progress the halo can make.
 *
 * The roster only ever grows, and it is bounded by the answer's own length: an
 * id is a position in the word, so a word cannot contribute more letters than
 * it has.
 */
export function mergeRoster(
    previous: readonly PoolLetter[],
    pool: readonly PoolLetter[],
): PoolLetter[] {
    const seen = new Set(previous.map((letter) => letter.id));
    const arrivals = pool.filter((letter) => !seen.has(letter.id));

    // Returned unchanged when nothing is new, so the layout below memoises
    // rather than re-solving on every keystroke.
    if (arrivals.length === 0) return previous as PoolLetter[];

    return [...previous, ...arrivals];
}

/**
 * The ids currently in the pool, for choosing which of the roster's spots are
 * occupied.
 *
 * A letter in flight is still in the pool — the composer keeps it there until
 * it lands, which is what gives the flight something to leave from — so this is
 * the live set and not the set of letters that have never moved.
 */
export function occupiedIds(pool: readonly PoolLetter[]): Set<string> {
    return new Set(pool.map((letter) => letter.id));
}
