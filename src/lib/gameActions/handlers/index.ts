import type { ActionHandler } from '../context';
import { handleGetHint } from './getHint';
import { handleGiveUp, handleLeaveGame, handleResetGame } from './lifecycle';
import { handleSolveAttempt } from './solveAttempt';
import { handleConfirmSolve, handleDenySolve, handleProposeSolve } from './solveProposal';

/**
 * Every action the game API accepts. Anything not listed here is rejected with
 * a 400 rather than silently succeeding.
 *
 * Adding an action means adding it here; `handlers.test.ts` asserts this map
 * stays in step with the actions the client sends.
 */
export const ACTION_HANDLERS: Record<string, ActionHandler> = {
    propose_solve: handleProposeSolve,
    deny_solve: handleDenySolve,
    confirm_solve: handleConfirmSolve,
    solve_attempt: handleSolveAttempt,
    get_hint: handleGetHint,
    give_up: handleGiveUp,
    leave_game: handleLeaveGame,
    reset_game: handleResetGame,
};

export type GameAction = keyof typeof ACTION_HANDLERS;
