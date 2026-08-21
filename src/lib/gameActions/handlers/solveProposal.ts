import type { ActionContext } from '../context';
import { getActivePlayerIds, startSolvingPhase } from '../gameState';
import { allActivePlayersConfirmed } from '../rules';

/**
 * Opens a vote to switch the game from texting into solving.
 *
 * The proposer counts as the first confirmation, which is why a solo game
 * flips straight over without waiting for anyone.
 */
export async function handleProposeSolve(ctx: ActionContext): Promise<void> {
    const confirmations = [ctx.user.id];

    const { error } = await ctx.supabase
        .from('games')
        .update({
            solving_proposal_created_at: new Date().toISOString(),
            solve_proposal_confirmations: confirmations,
        })
        .eq('id', ctx.gameId);

    if (error) throw error;

    const activePlayerIds = await getActivePlayerIds(ctx);
    if (allActivePlayersConfirmed(activePlayerIds, confirmations)) {
        await startSolvingPhase(ctx);
    }
}

/** Cancels an open proposal, returning the game to plain texting. */
export async function handleDenySolve(ctx: ActionContext): Promise<void> {
    const { error } = await ctx.supabase
        .from('games')
        .update({
            solving_proposal_created_at: null,
            solve_proposal_confirmations: [],
        })
        .eq('id', ctx.gameId);

    if (error) throw error;
}

/**
 * Adds this player's vote to an open proposal, switching to solving once
 * everyone still in the game has agreed. Confirming twice is a no-op.
 */
export async function handleConfirmSolve(ctx: ActionContext): Promise<void> {
    const { data: game } = await ctx.supabase
        .from('games')
        .select('solve_proposal_confirmations')
        .eq('id', ctx.gameId)
        .single();

    if (!game) throw new Error('Game not found');

    const current: string[] = game.solve_proposal_confirmations || [];
    if (current.includes(ctx.user.id)) return;

    const confirmations = [...current, ctx.user.id];
    const activePlayerIds = await getActivePlayerIds(ctx);

    if (allActivePlayersConfirmed(activePlayerIds, confirmations)) {
        await startSolvingPhase(ctx);
        return;
    }

    await ctx.supabase
        .from('games')
        .update({ solve_proposal_confirmations: confirmations })
        .eq('id', ctx.gameId);
}
