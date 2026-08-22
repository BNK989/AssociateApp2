import { GAME_CONFIG } from '@/lib/gameConfig';
import { calculateMessageValue, HINT_COSTS } from '@/lib/gameLogic';

// Shared with the daily game; re-exported so callers have one import site.
export { findTargetMessage, MAX_STRIKES } from '@/lib/gameLogic';


/** Guess similarity at or above this counts as correct. */
export const MATCH_THRESHOLD = 0.8;

/** Penalty applied when a correct answer was only a fuzzy match. */
export const ACCURACY_PENALTY = 0.1;

/** The proposal vote closes after this long and switches the game over. */
export const PROPOSAL_TIMEOUT_MS = GAME_CONFIG.SOLVE_PROPOSAL_TIMEOUT_SECONDS * 1000;


type CanActArgs = {
    /** Author of the word being guessed. */
    authorId: string;
    currentUserId?: string;
    /** Seconds remaining on the author's exclusive window; 0 means it has expired. */
    solvingTimeLeft: number | null;
    /** Whether the author has left the game. */
    authorHasLeft: boolean;
};

/**
 * Whether this player may act on the current word — solve it, give up on it, or
 * buy a hint for it.
 *
 * The author owns their word until the window closes. A word whose author has
 * left is open immediately, otherwise nobody could ever clear it and the game
 * would stall.
 *
 * The same check gates all three actions, so it lives in one place; previously
 * it was written out three times.
 */
export function canActOnTarget({
    authorId,
    currentUserId,
    solvingTimeLeft,
    authorHasLeft,
}: CanActArgs): boolean {
    if (authorId === currentUserId) return true;
    if (solvingTimeLeft === 0) return true;
    return authorHasLeft;
}

/**
 * Score multiplier for a run of correct answers, doubled again during fever.
 *
 * Classic escalates across three tiers; the daily game uses a simpler single
 * bonus, which is why the two are not shared.
 */
export function getStreakMultiplier(consecutive: number, feverRemaining = 0): number {
    let multiplier = 1;
    if (consecutive >= 4) multiplier = 2;
    else if (consecutive === 3) multiplier = 1.5;
    else if (consecutive === 2) multiplier = 1.2;

    return feverRemaining > 0 ? multiplier * 2 : multiplier;
}

/**
 * Fraction of a word's value forfeited for hints already bought.
 *
 * Tiers are cumulative: level 3 has paid for all three.
 */
export function getHintDeduction(hintLevel: number): number {
    let deduction = 0;
    if (hintLevel >= 1) deduction += HINT_COSTS.TIER_1;
    if (hintLevel >= 2) deduction += HINT_COSTS.TIER_2;
    if (hintLevel >= 3) deduction += HINT_COSTS.TIER_3;
    return deduction;
}

/**
 * Points a correct answer is worth before the streak multiplier.
 *
 * A fuzzy match still counts as correct but forfeits a little on top of any
 * hint deductions, so an exact answer is always worth more.
 */
export function getSolveValue(word: string, hintLevel: number, similarity: number): number {
    const base = calculateMessageValue(word);
    const accuracyPenalty = similarity < 1.0 ? ACCURACY_PENALTY : 0;

    return Math.floor(base * (1 - getHintDeduction(hintLevel) - accuracyPenalty));
}

export type MessageRejection =
    | 'empty'
    | 'not-your-turn'
    | 'word-count'
    | 'too-long'
    | 'duplicate';

type ValidateArgs = {
    input: string;
    existingContents: string[];
    isMyTurn: boolean;
    /** The first word may be sent by anyone, to get a game moving. */
    isFirstWord: boolean;
};

/**
 * Why an outgoing word cannot be sent, or null if it can.
 *
 * Duplicates are rejected because the chain is solved from memory — repeating a
 * word would make two positions indistinguishable.
 */
export function validateOutgoingMessage({
    input,
    existingContents,
    isMyTurn,
    isFirstWord,
}: ValidateArgs): MessageRejection | null {
    const trimmed = input.trim();
    if (!trimmed) return 'empty';

    if (!isFirstWord && !isMyTurn) return 'not-your-turn';

    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < GAME_CONFIG.MESSAGE_WORD_LIMIT_MIN || wordCount > GAME_CONFIG.MESSAGE_WORD_LIMIT_MAX) {
        return 'word-count';
    }

    if (trimmed.length > GAME_CONFIG.MESSAGE_MAX_LENGTH) return 'too-long';

    const lowered = trimmed.toLowerCase();
    if (existingContents.some((content) => content.toLowerCase() === lowered)) return 'duplicate';

    return null;
}

/**
 * Whole seconds left on a countdown, floored at zero.
 *
 * Shared by the proposal vote and the solving window, which previously each
 * inlined the same arithmetic.
 */
export function getRemainingSeconds(
    startedAt: string | null | undefined,
    durationMs: number,
    now: number = Date.now(),
): number {
    if (!startedAt) return 0;

    const elapsed = now - new Date(startedAt).getTime();
    const remaining = durationMs - elapsed;

    return remaining <= 0 ? 0 : Math.ceil(remaining / 1000);
}
