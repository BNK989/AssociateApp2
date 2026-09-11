import { LETTER_POOL } from '@/lib/gameConfig';

/**
 * How the composer's slot strip behaves, as a game master can tune it.
 *
 * Mirrors `hintPolicy.ts` and `feedbackPolicy.ts` in shape and contract: a
 * total parser with a per-field fallback to the compiled constants, so an
 * absent or malformed `letter_pool` row degrades to today's behaviour rather
 * than taking the composer down.
 *
 * Only the caret rule is tunable. Whether the pool exists at all stays a
 * compiled constant: it decides what the *word line* draws, which is read in
 * several client modules that have no route to a server-read setting, and a
 * half-applied switch would be worse than no switch.
 */
export type LetterPoolPolicy = {
    /**
     * On, the composer reads the keystrokes rather than imposing a shape: the
     * caret rests on the first gap, but typing the answer out in full works
     * too, and `resolveTyping` decides which the player meant from what they
     * typed. Off pins it to the whole word, where a keystroke that disagrees
     * with a confirmed letter is marked rather than accommodated.
     *
     * The name is now narrower than the behaviour — it survives because it is
     * the stored key and renaming it would orphan the row.
     */
    caretSkipsGreens: boolean;
};

/** The policy that reproduces the behaviour compiled into `gameConfig.ts`. */
export const DEFAULT_LETTER_POOL_POLICY: LetterPoolPolicy = {
    caretSkipsGreens: LETTER_POOL.CARET_SKIPS_GREENS,
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Narrows a stored jsonb blob into a policy, per field.
 *
 * An absent field falls back to the compiled constant rather than to a
 * spelled-out copy of the defaults, which is why the seeded row is `{}`: it
 * cannot drift from `gameConfig.ts` the way a duplicated default would.
 */
export function parseLetterPoolPolicy(value: unknown): LetterPoolPolicy {
    if (!isRecord(value)) return DEFAULT_LETTER_POOL_POLICY;

    return {
        caretSkipsGreens: typeof value.caretSkipsGreens === 'boolean'
            ? value.caretSkipsGreens
            : DEFAULT_LETTER_POOL_POLICY.caretSkipsGreens,
    };
}
