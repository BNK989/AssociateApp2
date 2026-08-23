import { generateCipherString } from '@/lib/gameLogic';
import { MAX_HINT_LEVEL, needsScrambleVisuals } from './dailyScoring';

/**
 * Turning a hint level into what the player actually sees.
 *
 * Two paths raise a word's hint level — the ladder (manual or automatic) and
 * the start level applied as the player arrives at a word — and both have to
 * produce the same cipher and clue for a given level, or the same word would
 * look different depending on how it got there. The derivation lives here so
 * there is one copy of it under test.
 */

/** The fields a level change writes onto a message. */
export type HintLevelUpdates = {
    hint_level: number;
    cipher_text: string;
    /** Only set when the new level is the AI clue. */
    ai_hint?: string;
};

type HintLevelArgs = {
    word: string;
    /** Level the word is at now. */
    currentLevel: number;
    /** Level it is being raised to. */
    nextLevel: number;
    /** Mask currently on the message, reused when the clue sits on top of it. */
    currentCipher?: string;
    /** Clue text, required when `nextLevel` is the AI clue. */
    clue?: string;
};

/**
 * The message patch that moves a word from one hint level to another.
 *
 * The AI clue is level 3 but there is no level-3 mask: the clue sits on top of
 * the level-2 scramble. So a player who skipped straight to the clue still
 * needs that scramble generated, while one who was already at level 2 keeps the
 * mask they have been looking at rather than having it re-shuffled under them.
 */
export function hintLevelUpdates({
    word,
    currentLevel,
    nextLevel,
    currentCipher,
    clue,
}: HintLevelArgs): HintLevelUpdates {
    const cipherLevel = Math.min(nextLevel, 2);

    const cipher_text = nextLevel < MAX_HINT_LEVEL || needsScrambleVisuals(currentLevel, nextLevel)
        ? generateCipherString(word, cipherLevel, true)
        : (currentCipher || generateCipherString(word, 2, true));

    const updates: HintLevelUpdates = { hint_level: nextLevel, cipher_text };

    if (nextLevel === MAX_HINT_LEVEL && clue !== undefined) {
        updates.ai_hint = clue;
    }

    return updates;
}
