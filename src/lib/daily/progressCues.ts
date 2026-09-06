import { STREAK_BONUS_AT } from '@/lib/gameConfig';
import type { WordOutcome } from './dailyResults';

/**
 * The nudge shown after a word leaves the board, if any.
 *
 * The daily chain gives a player no reason to keep going once a word gets away
 * from them: the board just advances and the run quietly ends. The results hook
 * exists precisely because mid-chain abandonment is the number that matters
 * most, so these cues target the two moments where a player decides to stop --
 * straight after a miss, and in the stretch where the finish is close enough to
 * be worth reaching for.
 */
export type ProgressCue = 'final_word' | 'recover' | 'streak' | 'halfway';

export type CueArgs = {
    /** How the word that just left the board went. */
    outcome: WordOutcome;
    /** Words still in play after it left. */
    remaining: number;
    /** Guessable words in the whole chain. */
    total: number;
    /** Solves in a row, counted after this word. */
    consecutive: number;
    /** Whether that word finished the chain. */
    completed: boolean;
};

/**
 * At most one cue per word.
 *
 * Ordering is by how time-critical the message is rather than how good the news
 * is: a player one word from the end should hear that and nothing else, and a
 * player who just lost a word needs a reason to stay more than they need to be
 * told they are halfway. Anything that fires on every word stops being read, so
 * each of these can only fire on the single move that makes it true.
 */
export function nextProgressCue({
    outcome,
    remaining,
    total,
    consecutive,
    completed,
}: CueArgs): ProgressCue | null {
    // The end screen speaks for the finished chain; a toast under it is noise.
    if (completed || remaining <= 0) return null;

    if (remaining === 1) return 'final_word';

    // A miss is where the run is abandoned, so it gets the reassurance.
    if (outcome !== 'solved') return 'recover';

    // Only on the solve that switches the multiplier on, not every one after.
    if (consecutive === STREAK_BONUS_AT) return 'streak';

    // Fires on the move that crosses the midpoint, and only that move.
    if (remaining <= total / 2 && remaining + 1 > total / 2) return 'halfway';

    return null;
}
