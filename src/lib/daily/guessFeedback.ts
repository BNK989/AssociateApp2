import { MATCH_THRESHOLD } from '@/lib/gameConfig';

/**
 * How close a wrong guess was to the word.
 *
 * The daily game used to treat every wrong guess identically: a shake, a tone
 * and a strike. A player who typed `elephants` for `elephant` got exactly what
 * a player who typed a random noun got, which reads as the game not looking at
 * the answer at all — and it is the cheapest place in the whole game to show
 * that it is.
 *
 * The measure is `calculateSimilarity`, which is Levenshtein-based, so this is
 * a statement about **spelling**, never about meaning. `near` means "you almost
 * typed the word", not "you are close in the association". Copy built on this
 * band has to say so, or it promises a semantic hint the game cannot give.
 */
export type GuessBand = 'match' | 'near' | 'off';

/**
 * Similarity at or above which a miss is worth remarking on.
 *
 * Sits below `MATCH_THRESHOLD` (0.8), so the band covers the gap between "close
 * enough to accept" and "close enough to mention". On Levenshtein ratios a
 * plural, a doubled letter or a transposition lands in here; two unrelated
 * words of the same length rarely clear 0.4.
 *
 * A starting value, not a tuned one — it wants real play data behind it before
 * it hardens. Every miss reports its band *and* its raw similarity to PostHog
 * precisely so this number can be checked against what players actually type.
 */
export const NEAR_MISS_THRESHOLD = 0.6;

/** Near misses forgiven per word before they start costing strikes again. */
export const MAX_FORGIVEN_NEAR_MISSES = 1;

/** Which band a guess falls in, given its similarity to the target. */
export function bandFor(similarity: number): GuessBand {
    if (similarity >= MATCH_THRESHOLD) return 'match';
    if (similarity >= NEAR_MISS_THRESHOLD) return 'near';
    return 'off';
}

/**
 * Whether a miss should cost the player a strike.
 *
 * A near miss is a spelling slip on a word the player has already worked out,
 * and charging a strike for it retires words they genuinely solved. It is
 * forgiven instead — but only `MAX_FORGIVEN_NEAR_MISSES` times per word, so the
 * band cannot be farmed by walking a guess one letter at a time toward the
 * answer.
 */
export function consumesStrike(band: GuessBand, nearMissesAlreadyForgiven: number): boolean {
    if (band !== 'near') return true;
    return nearMissesAlreadyForgiven >= MAX_FORGIVEN_NEAR_MISSES;
}

/** The i18n key for the toast a miss earns, or null when it earns none. */
export function missMessageKey(band: GuessBand, forgiven: boolean): string | null {
    if (band !== 'near') return null;
    return forgiven ? 'miss_near_forgiven' : 'miss_near';
}
