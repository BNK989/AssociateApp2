import { NextResponse } from 'next/server';
import { appendGuess } from '@/lib/classicGame/classicRules';
import { createLogger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase-admin';
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

    // Awarding points is privileged: the function is SECURITY DEFINER and takes
    // the recipient and amount as arguments, so a client able to call it could
    // award itself anything. It runs through the service role here, and EXECUTE
    // is revoked from anon and authenticated in the database.
    const { error: rpcError } = await createAdminClient().rpc('distribute_game_points', {
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

/**
 * Whether an update failed only because a column is not in the database yet.
 *
 * PostgREST answers `PGRST204` from its schema cache; Postgres answers `42703`
 * when the statement reaches it.
 */
function isMissingColumn(error: { code?: string | null }): boolean {
    return error.code === 'PGRST204' || error.code === '42703';
}

/**
 * Records a wrong guess: the guess itself, one strike, and every streak back to
 * zero.
 *
 * The guess is what colours the word's tiles for everyone in the room, so it is
 * appended to the row rather than kept on the guesser's client — a refetch or
 * another player's screen would otherwise never see it. The list is read back
 * from the fetched row, not from the payload, so two players guessing at once
 * cannot drop each other's letters.
 */
async function applyWrongGuess(
    ctx: ActionContext,
    target: { id: string; guesses?: string[] | null },
    guess: string,
    currentStrikes: number | undefined,
): Promise<void> {
    const { strikes, isOutOfPlay } = applyStrike(currentStrikes);
    const strike = { strikes, is_solved: isOutOfPlay };

    const { error } = await ctx.supabase
        .from('messages')
        .update({ ...strike, guesses: appendGuess(target.guesses, guess) })
        .eq('id', target.id);

    if (error && isMissingColumn(error)) {
        // Apply supabase/migrations/20260912120000_add_guesses_to_messages.sql.
        // The strike still has to land without it, or a wrong guess costs
        // nothing and the word can never be lost.
        log.warn('wrong_guess', 'messages.guesses is missing, recording the strike only — apply 20260912120000_add_guesses_to_messages.sql', {
            game_id: ctx.gameId, user_id: ctx.user.id, message_id: target.id, code: error.code,
        });

        const { error: strikeError } = await ctx.supabase
            .from('messages')
            .update(strike)
            .eq('id', target.id);
        if (strikeError) throw strikeError;
    } else if (error) {
        throw error;
    }

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

    await applyWrongGuess(
        ctx,
        targetMessage,
        readString(payload, 'guess') ?? '',
        readNumber(payload, 'strikes'),
    );
}
