import { calculateMessageValue, calculateRevealedPercentage, HINT_COSTS } from '@/lib/gameLogic';
import { GAME_CONFIG } from '@/lib/gameConfig';

/** Guess similarity at or above this counts as correct. */
export const MATCH_THRESHOLD = 0.8;

/** Consecutive solves needed before the streak bonus applies. */
export const STREAK_BONUS_AT = 3;

export const STREAK_MULTIPLIER = 1.5;

/** Highest hint level; level 3 is the AI clue. */
export const MAX_HINT_LEVEL = 3;

/** Strikes before a word is retired unsolved. */
export const MAX_STRIKES = 3;

/**
 * Points for solving a word.
 *
 * Base value comes from the word itself, then each hint level already bought
 * subtracts its tier — cumulatively, so a player who took all three hints keeps
 * only a small fraction. A streak multiplies whatever is left.
 */
export function calculateSolvePoints(
    word: string,
    hintLevel: number,
    consecutive: number,
): number {
    const base = calculateMessageValue(word);

    let deduction = 0;
    if (hintLevel >= 1) deduction += HINT_COSTS.TIER_1;
    if (hintLevel >= 2) deduction += HINT_COSTS.TIER_2;
    if (hintLevel >= 3) deduction += HINT_COSTS.TIER_3;

    const streakBonus = consecutive >= STREAK_BONUS_AT ? STREAK_MULTIPLIER : 1;

    return Math.floor(base * (1 - deduction) * streakBonus);
}

type NextHintArgs = {
    currentLevel: number;
    word: string;
    /** Wrong guesses so far, which may already have exposed letters. */
    guesses: string[];
    revealType?: string;
};

/**
 * The hint level a player should land on when they ask for a hint.
 *
 * Usually the next one up, but two skips exist so a player never pays for a
 * hint that would tell them nothing:
 *
 * - Level 1 reveals the first letter. If their guesses already exposed it,
 *   skip straight to level 2.
 * - Level 2 re-scrambles what is left. If the word is already mostly revealed,
 *   that is useless, so skip to the AI clue.
 *
 * The `ALL` reveal type overrides both and jumps straight to the AI clue.
 */
export function getNextHintLevel({
    currentLevel,
    word,
    guesses,
    revealType = GAME_CONFIG.DEFAULT_AUTO_HINT_REVEAL_TYPE,
}: NextHintArgs): number {
    if (currentLevel >= MAX_HINT_LEVEL) return currentLevel;

    if (revealType === 'ALL') return MAX_HINT_LEVEL;

    let nextLevel = currentLevel + 1;

    const firstLetter = word[0]?.toLowerCase();
    const firstLetterKnown = firstLetter !== undefined
        && guesses.some((g) => g.toLowerCase().includes(firstLetter));

    if (currentLevel === 0 && firstLetterKnown) {
        nextLevel = 2;
    }

    if (nextLevel === 2) {
        const revealed = calculateRevealedPercentage(word, guesses);
        if (revealed >= GAME_CONFIG.PERCENT_REVEALED_SHUFFLE_HINT) {
            nextLevel = MAX_HINT_LEVEL;
        }
    }

    return nextLevel;
}

/**
 * Whether jumping to this level needs level-2 scramble visuals generated.
 *
 * The AI clue sits on top of a scrambled word, so a player who skipped straight
 * to level 3 still needs the scramble rendered underneath it.
 */
export function needsScrambleVisuals(currentLevel: number, nextLevel: number): boolean {
    return nextLevel === MAX_HINT_LEVEL && currentLevel < 2;
}
