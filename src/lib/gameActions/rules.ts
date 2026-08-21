import { GAME_CONFIG } from '@/lib/gameConfig';

/** Consecutive team solves needed to trigger fever mode. */
export const FEVER_TRIGGER_STREAK = 5;

/** Solves granted when fever mode triggers. */
export const FEVER_DURATION = 3;

/** A message is out of play once it has taken this many strikes. */
export const MAX_STRIKES = 3;

/**
 * Whether the turn has opened up to everyone.
 *
 * During solving, the message's author gets first crack at it. Once the window
 * elapses anyone may steal it. A game with no recorded start time is treated as
 * free-for-all, since the timer cannot be trusted.
 */
export function isFreeForAll(
    solvingStartedAt: string | null | undefined,
    now: number = Date.now(),
): boolean {
    const startedAt = solvingStartedAt ? new Date(solvingStartedAt).getTime() : 0;
    const windowMs = (GAME_CONFIG.SOLVING_MODE_DURATION_SECONDS || 20) * 1000;
    return (now - startedAt) > windowMs;
}

/**
 * Whether every player still in the game has agreed to switch to solving.
 *
 * An empty roster is never "all confirmed" — that would let a game with no
 * active players flip itself into solving.
 */
export function allActivePlayersConfirmed(
    activePlayerIds: string[],
    confirmations: string[],
): boolean {
    return activePlayerIds.length > 0
        && activePlayerIds.every((id) => confirmations.includes(id));
}

export type TeamStats = {
    team_consecutive_correct: number;
    fever_mode_remaining: number;
};

/**
 * Team streak and fever counters after a correct solve.
 *
 * Each solve extends the streak and burns one fever solve. Reaching the trigger
 * streak with no fever left starts a fresh fever run — the burn is applied
 * first, so the streak that reaches the threshold is the one that lights it.
 */
export function nextTeamStats(current: Partial<TeamStats> | null | undefined): TeamStats {
    const streak = (current?.team_consecutive_correct || 0) + 1;
    const fever = Math.max(0, (current?.fever_mode_remaining || 0) - 1);

    return {
        team_consecutive_correct: streak,
        fever_mode_remaining: streak >= FEVER_TRIGGER_STREAK && fever === 0
            ? FEVER_DURATION
            : fever,
    };
}

/** Team counters after a wrong guess or a give-up: everything resets. */
export function resetTeamStats(): TeamStats {
    return { team_consecutive_correct: 0, fever_mode_remaining: 0 };
}

/** Strike count after a wrong guess, and whether that retires the message. */
export function applyStrike(currentStrikes: number | null | undefined): {
    strikes: number;
    isOutOfPlay: boolean;
} {
    const strikes = (currentStrikes || 0) + 1;
    return { strikes, isOutOfPlay: strikes >= MAX_STRIKES };
}
