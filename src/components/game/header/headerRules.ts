import type { GameState, Message, Player } from '@/hooks/useGameLogic';
import { FEVER_TRIGGER_STREAK } from '@/lib/gameActions/rules';

/**
 * Whose turn the header should highlight.
 *
 * While texting that is simply whoever is up. While solving it is the *author*
 * of the word being guessed, since that is the player whose turn it is to be
 * guessed at — not the player doing the guessing.
 */
export function getActivePlayerId(
    game: GameState,
    targetMessage?: Message,
): string | undefined {
    if (game.status === 'solving' && targetMessage) {
        return targetMessage.user_id;
    }
    return game.current_turn_user_id;
}

/**
 * Orders the avatar stack so the active player renders last.
 *
 * The stack overlaps with a negative gap, so later elements paint on top; the
 * active player has to be last to sit above their neighbours.
 */
export function sortPlayersForStack(players: Player[], activePlayerId?: string): Player[] {
    return [...players].sort((a, b) => {
        if (a.user_id === activePlayerId) return 1;
        if (b.user_id === activePlayerId) return -1;
        return 0;
    });
}

/** Percentage fill of the team-flow bar, which loops every fever cycle. */
export function getTeamFlowProgress(consecutiveCorrect: number | null | undefined): number {
    return ((consecutiveCorrect || 0) % FEVER_TRIGGER_STREAK) * (100 / FEVER_TRIGGER_STREAK);
}

/** Whether this player is (jointly) top of the scoreboard. A scoreless game has no leader. */
export function isScoreLeader(players: Player[], userId?: string): boolean {
    const myScore = players.find((p) => p.user_id === userId)?.score || 0;
    const maxScore = Math.max(0, ...players.map((p) => p.score || 0));
    return myScore === maxScore && myScore > 0;
}

/** Players still in the game, used for the "n/m agreed" proposal count. */
export function countActivePlayers(players: Player[]): number {
    return players.filter((p) => !p.has_left).length;
}

/**
 * Step size for a count-up animation, fixed for the whole run.
 *
 * Sized so any distance closes in roughly `frames` ticks, which keeps a
 * one-point nudge and a hundred-point jump feeling about the same length.
 * Computed once when the animation starts — recomputing it per frame would
 * make the movement decelerate instead of running at a constant rate.
 */
export function countUpStepSize(from: number, to: number, frames = 10): number {
    return Math.max(1, Math.ceil(Math.abs(to - from) / frames));
}

/**
 * One frame of a count-up: advances `current` toward `target` by `step`,
 * snapping to the target once it is within a single step so the value always
 * lands exactly rather than oscillating around it.
 */
export function countUpFrame(current: number, target: number, step: number): number {
    const remaining = target - current;
    if (Math.abs(remaining) <= step) return target;
    return current + (remaining > 0 ? step : -step);
}
