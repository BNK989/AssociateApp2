import { NextResponse } from 'next/server';
import type { ActionContext, ActionPayload } from '../context';
import { readString } from '../context';
import { captureStatusChange, completeGameOrAdvanceTurn } from '../gameState';
import { resetTeamStats } from '../rules';

/**
 * Removes the player from the game.
 *
 * Delegated to a Postgres function because leaving also has to post a system
 * message and rotate the turn if it was theirs — all of which must happen in
 * one transaction.
 */
export async function handleLeaveGame(ctx: ActionContext): Promise<void> {
    const { error } = await ctx.supabase.rpc('player_leave_game', { p_game_id: ctx.gameId });
    if (error) throw error;
}

/** Admin action: returns a finished game to texting with all progress cleared. */
export async function handleResetGame(ctx: ActionContext): Promise<void> {
    const { error: gameError } = await ctx.supabase
        .from('games')
        .update({
            status: 'texting',
            solving_started_at: null,
            solving_proposal_created_at: null,
            solve_proposal_confirmations: [],
            ...resetTeamStats(),
        })
        .eq('id', ctx.gameId);
    if (gameError) throw gameError;

    // A reset game has no solved messages, so the count is known to be zero.
    await captureStatusChange(ctx, 'texting', { countMessages: false });

    const { error: msgError } = await ctx.supabase
        .from('messages')
        .update({
            is_solved: false,
            hint_level: 0,
            ai_hint: null,
            strikes: 0,
            winner_points: 0,
            author_points: 0,
            solved_by: null,
        })
        .eq('game_id', ctx.gameId);
    if (msgError) throw msgError;

    const { error: playerError } = await ctx.supabase
        .from('game_players')
        .update({ score: 0, consecutive_correct_guesses: 0 })
        .eq('game_id', ctx.gameId);
    if (playerError) throw playerError;
}

/**
 * Retires a message nobody could solve: marked solved, worth nothing, and every
 * streak reset. The client renders a zero-point solve as a loss.
 */
export async function handleGiveUp(
    ctx: ActionContext,
    payload: ActionPayload,
): Promise<Response | void> {
    const targetId = readString(payload, 'targetId');
    const userId = readString(payload, 'userId') ?? ctx.user.id;

    if (!targetId) {
        return NextResponse.json({ error: 'Missing targetId' }, { status: 400 });
    }

    const { data: targetMessage, error: targetError } = await ctx.supabase
        .from('messages')
        .select('id')
        .eq('id', targetId)
        .single();

    if (targetError || !targetMessage) {
        return NextResponse.json({ error: 'Target message not found' }, { status: 404 });
    }

    const { error: msgError } = await ctx.supabase
        .from('messages')
        .update({
            is_solved: true,
            solved_by: userId,
            winner_points: 0,
            author_points: 0,
        })
        .eq('id', targetId);
    if (msgError) throw msgError;

    await ctx.supabase
        .from('game_players')
        .update({ consecutive_correct_guesses: 0 })
        .eq('game_id', ctx.gameId)
        .eq('user_id', userId);

    await ctx.supabase
        .from('games')
        .update(resetTeamStats())
        .eq('id', ctx.gameId);

    await completeGameOrAdvanceTurn(ctx);
}
