import { calculateMessageValue, calculateRevealedPercentage } from '@/lib/gameLogic';
import { DEFAULT_HINT_POLICY, type HintProgression } from './hintPolicy';
import {
    GAME_CONFIG,
    HINT_COSTS,
    MATCH_THRESHOLD,
    MAX_HINT_LEVEL,
    MAX_STRIKES,
    STREAK_BONUS_AT,
    STREAK_MULTIPLIER,
} from '@/lib/gameConfig';

// Re-exported so existing import sites keep working; the definitions now live
// in gameConfig.ts alongside the rest of the game's balance. This file used to
// declare its own MAX_STRIKES, duplicating the one in gameLogic.ts.
export { MATCH_THRESHOLD, MAX_HINT_LEVEL, MAX_STRIKES, STREAK_BONUS_AT, STREAK_MULTIPLIER };

/**
 * Tier keys in ladder order, so a level maps to its cost.
 *
 * Deliberately the keys and not the values: reading `HINT_COSTS` at module load
 * would break any test that partially mocks the config module, and would do so
 * at import time with a stack trace pointing here rather than at the mock.
 */
const TIER_KEYS = ['TIER_1', 'TIER_2', 'TIER_3'] as const;

export type SolveScoringOptions = {
    /** Hint level the word opened at, which the player never asked for. */
    startLevel?: number;
    /**
     * Whether a hint the player was given for free still costs them points.
     *
     * Defaults to true, which is how scoring has always worked. Turning it off
     * matters as soon as a game master raises the start level: otherwise every
     * solve is silently docked for a hint nobody requested, and scores stop
     * being comparable with every score recorded before the change.
     */
    chargeForStartLevel?: boolean;
};

/**
 * Points for solving a word.
 *
 * Base value comes from the word itself, then each hint tier the player passed
 * through subtracts its cost — cumulatively, so someone who took all three
 * keeps only a small fraction. A streak multiplies whatever is left.
 *
 * Tiers at or below `startLevel` are skipped when the policy says free hints
 * are free.
 */
export function calculateSolvePoints(
    word: string,
    hintLevel: number,
    consecutive: number,
    options: SolveScoringOptions = {},
): number {
    const { startLevel = 0, chargeForStartLevel = true } = options;
    const base = calculateMessageValue(word);

    let deduction = 0;
    for (let tier = 1; tier <= MAX_HINT_LEVEL; tier += 1) {
        if (hintLevel < tier) continue;
        if (!chargeForStartLevel && tier <= startLevel) continue;
        deduction += HINT_COSTS[TIER_KEYS[tier - 1]];
    }

    const streakBonus = consecutive >= STREAK_BONUS_AT ? STREAK_MULTIPLIER : 1;

    return Math.floor(base * (1 - deduction) * streakBonus);
}

type NextHintArgs = {
    currentLevel: number;
    word: string;
    /** Wrong guesses so far, which may already have exposed letters. */
    guesses: string[];
    progression?: HintProgression;
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
 * The `jump` progression overrides both and goes straight to the AI clue.
 */
export function getNextHintLevel({
    currentLevel,
    word,
    guesses,
    progression = DEFAULT_HINT_POLICY.progression,
}: NextHintArgs): number {
    if (currentLevel >= MAX_HINT_LEVEL) return currentLevel;

    if (progression === 'jump') return MAX_HINT_LEVEL;

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
