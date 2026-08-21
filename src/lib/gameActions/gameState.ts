import { getPostHogServer } from '@/app/posthog-server';
import { createLogger } from '@/lib/logger';
import type { ActionContext } from './context';
import { MAX_STRIKES } from './rules';

const log = createLogger('api/game/action');

/**
 * Reports a lifecycle transition to PostHog alongside the game's text-message
 * count, which is the metric the funnel is built on. Analytics must never fail
 * a player action, so errors are swallowed after logging.
 */
export async function captureStatusChange(
    ctx: ActionContext,
    status: 'texting' | 'solving' | 'completed',
    options: { countMessages?: boolean } = {},
): Promise<void> {
    const posthog = getPostHogServer();
    if (!posthog) return;

    try {
        let messagesCount = 0;

        if (options.countMessages !== false) {
            const { count } = await ctx.supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('game_id', ctx.gameId)
                .eq('type', 'text');
            messagesCount = count || 0;
        }

        posthog.capture({
            distinctId: ctx.user.id,
            event: 'game_status_change',
            properties: { game_id: ctx.gameId, status, messages_count: messagesCount },
        });
        await posthog.flush();
    } catch (error) {
        log.warn('capture_status', 'Failed to report status change to PostHog', {
            game_id: ctx.gameId, status,
        }, error);
    }
}

/** Ids of players who have not left the game. */
export async function getActivePlayerIds(ctx: ActionContext): Promise<string[]> {
    const { data } = await ctx.supabase
        .from('game_players')
        .select('user_id')
        .eq('game_id', ctx.gameId)
        .eq('has_left', false);

    return data?.map((p) => p.user_id) ?? [];
}

/**
 * Moves the game into solving: clears the proposal and starts the turn timer.
 *
 * Shared by both routes into solving — a solo host proposing, and the last
 * player confirming — so the two cannot drift apart.
 */
export async function startSolvingPhase(ctx: ActionContext): Promise<void> {
    await ctx.supabase
        .from('games')
        .update({
            status: 'solving',
            solving_proposal_created_at: null,
            solve_proposal_confirmations: [],
            solving_started_at: new Date().toISOString(),
        })
        .eq('id', ctx.gameId);

    await captureStatusChange(ctx, 'solving');
}

/**
 * After a message leaves play, either finish the game or hand the next turn a
 * fresh timer.
 *
 * A message counts as still in play only while unsolved *and* under the strike
 * limit, so a word nobody got does not block completion forever.
 */
export async function completeGameOrAdvanceTurn(ctx: ActionContext): Promise<void> {
    const { count: unsolvedCount } = await ctx.supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', ctx.gameId)
        .eq('is_solved', false)
        .lt('strikes', MAX_STRIKES);

    if (unsolvedCount === 0) {
        await ctx.supabase.from('games').update({ status: 'completed' }).eq('id', ctx.gameId);
        await captureStatusChange(ctx, 'completed');
        return;
    }

    // Restart the author's window for whoever is up next.
    await ctx.supabase
        .from('games')
        .update({ solving_started_at: new Date().toISOString() })
        .eq('id', ctx.gameId);
}
