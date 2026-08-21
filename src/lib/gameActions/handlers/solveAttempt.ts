import { NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import type { ActionContext, ActionPayload } from '../context';
import { readBoolean, readNumber, readString } from '../context';
import { completeGameOrAdvanceTurn } from '../gameState';
import { applyStrike, isFreeForAll, nextTeamStats, resetTeamStats } from '../rules';

const log = createLogger('api/game/action');

/**
 * Whether this player is allowed to solve this message right now.
 *
 * The author owns their word for the length of the solving window. After that
 * it is fair game for anyone. A word whose author has left the game is also
 * open immediately, otherwise it could never be solved.
 */
async function canSolveNow(
    ctx: ActionContext,
    authorId: string,
    solvingStartedAt: string | null,
): Promise<boolean> {
    if (authorId === ctx.user.id) return true;
    if (isFreeForAll(solvingStartedAt)) return true;

    const { data: author } = await ctx.supabase
        .from('game_players')
        .select('has_left')
        .eq('game_id', ctx.gameId)
        .eq('user_id', authorId)
        .single();

    return Boolean(author?.has_left);
}

/** Records a correct guess: points, streaks, and either completion or next turn. */
async function applyCorrectGuess(
    ctx: ActionContext,
    args: {
        targetId: string;
        winnerPoints: number;
        authorPoints: number;
        isSteal: boolean;
        targetUserId?: string;
        consecutive?: number;
        teamStats: { team_consecutive_correct?: number; fever_mode_remaining?: number } | null;
    },
): Promise<void> {
    const { targetId, winnerPoints, authorPoints, isSteal, targetUserId, consecutive } = args;

    const { error: msgError } = await ctx.supabase
        .from('messages')
        .update({
            is_solved: true,
            solved_by: ctx.user.id,
            winner_points: winnerPoints,
            author_points: isSteal ? authorPoints : 0,
        })
        .eq('id', targetId);
    if (msgError) throw msgError;

    const { error: rpcError } = await ctx.supabase.rpc('distribute_game_points', {
        game_id_param: ctx.gameId,
        winner_id: ctx.user.id,
        winner_amount: winnerPoints,
        author_id: isSteal ? targetUserId : null,
        author_amount: isSteal ? authorPoints : 0,
    });
    if (rpcError) throw rpcError;

    await ctx.supabase
        .from('game_players')
        .update({ consecutive_correct_guesses: consecutive })
        .eq('game_id', ctx.gameId)
        .eq('user_id', ctx.user.id);

    await ctx.supabase
        .from('games')
        .update(nextTeamStats(args.teamStats))
        .eq('id', ctx.gameId);

    await completeGameOrAdvanceTurn(ctx);
}

/** Records a wrong guess: one strike, and every streak back to zero. */
async function applyWrongGuess(
    ctx: ActionContext,
    targetId: string,
    currentStrikes: number | undefined,
): Promise<void> {
    const { strikes, isOutOfPlay } = applyStrike(currentStrikes);

    await ctx.supabase
        .from('messages')
        .update({ strikes, is_solved: isOutOfPlay })
        .eq('id', targetId);

    await ctx.supabase
        .from('game_players')
        .update({ consecutive_correct_guesses: 0 })
        .eq('game_id', ctx.gameId)
        .eq('user_id', ctx.user.id);

    await ctx.supabase
        .from('games')
        .update(resetTeamStats())
        .eq('id', ctx.gameId);
}

/** A player's guess at a ciphered message, right or wrong. */
export async function handleSolveAttempt(
    ctx: ActionContext,
    payload: ActionPayload,
): Promise<Response | void> {
    const targetId = readString(payload, 'targetId');
    if (!targetId) {
        return NextResponse.json({ error: 'Missing targetId' }, { status: 400 });
    }

    const { data: targetMessage, error: targetError } = await ctx.supabase
        .from('messages')
        .select('*')
        .eq('id', targetId)
        .single();

    if (targetError || !targetMessage) {
        return NextResponse.json({ error: 'Target message not found' }, { status: 404 });
    }

    const { data: game } = await ctx.supabase
        .from('games')
        .select('*')
        .eq('id', ctx.gameId)
        .single();

    if (!game) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (!await canSolveNow(ctx, targetMessage.user_id, game.solving_started_at)) {
        log.warn('solve_out_of_turn', 'Rejected solve attempt outside the player turn', {
            game_id: ctx.gameId, user_id: ctx.user.id, target_author_id: targetMessage.user_id,
        });
        return NextResponse.json({ error: 'Not your turn! Wait for Free-for-all.' }, { status: 403 });
    }

    if (readBoolean(payload, 'isMatch')) {
        await applyCorrectGuess(ctx, {
            targetId,
            winnerPoints: readNumber(payload, 'winnerPoints') ?? 0,
            authorPoints: readNumber(payload, 'authorPoints') ?? 0,
            isSteal: readString(payload, 'type') === 'STEAL',
            targetUserId: readString(payload, 'targetUserId'),
            consecutive: readNumber(payload, 'consecutive'),
            teamStats: game,
        });
        return;
    }

    await applyWrongGuess(ctx, targetId, readNumber(payload, 'strikes'));
}
