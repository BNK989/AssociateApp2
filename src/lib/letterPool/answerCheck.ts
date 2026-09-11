import { isCorrectAnswer } from '@/lib/gameLogic';
import { LETTER_POOL } from '@/lib/gameConfig';
import { stripSuppliesShape } from './poolRules';

/**
 * Whether a submitted answer is right, given how much of it the game supplied.
 *
 * One place, because the three solve paths — daily, classic room, and the
 * admin demo — must not be able to disagree about it. The rule: once the slot
 * strip is drawing the answer's shape, the comparison is exact.
 *
 * That is a correctness fix rather than a strictness preference. The strip
 * fills confirmed letters in for the player, so a fuzzy threshold scores
 * letters they never wrote: a seven-letter word with six confirmed reaches
 * 0.857 with its last letter wrong, and passes a 0.8 threshold. The strip also
 * fixes the length and the shape, so there is no typo left for fuzziness to
 * forgive — a wrong letter is simply a wrong answer.
 *
 * Free typing keeps the fuzzy match it was written for.
 */
export function checkAnswer(
    guess: string,
    target: string,
    { hintLevel, isSinglePlayer }: { hintLevel: number; isSinglePlayer: boolean },
): boolean {
    return isCorrectAnswer(guess, target, {
        exact: stripSuppliesShape({ enabled: LETTER_POOL.ENABLED, hintLevel, isSinglePlayer }),
    });
}
