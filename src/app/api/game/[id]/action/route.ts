import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createLogger, normalizeError } from '@/lib/logger';
import type { ActionContext } from '@/lib/gameActions/context';
import { ACTION_HANDLERS } from '@/lib/gameActions/handlers';

const log = createLogger('api/game/action');

async function createRequestClient() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options),
                        );
                    } catch {
                        // Called from a context where cookies are read-only; the
                        // session is refreshed by the proxy instead.
                    }
                },
            },
        },
    );
}

/**
 * Single write endpoint for a game.
 *
 * Authenticates the caller, then dispatches to the handler for the requested
 * action. Handlers run against the caller's own client, so row-level security
 * still applies to everything they do.
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: gameId } = await params;
    const supabase = await createRequestClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { action, payload } = await request.json();
        log.debug('receive_action', 'Action received', { game_id: gameId, user_id: user.id, action });

        const handler = ACTION_HANDLERS[action];
        if (!handler) {
            log.warn('receive_action', 'Unknown action requested', { game_id: gameId, user_id: user.id, action });
            return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }

        const ctx: ActionContext = { supabase, gameId, user, request };
        const response = await handler(ctx, payload ?? {});

        return response ?? NextResponse.json({ success: true });
    } catch (err: unknown) {
        log.error('handle_action', 'Unhandled error while processing action', { game_id: gameId, user_id: user.id }, err);

        const normalized = normalizeError(err);
        return NextResponse.json(
            {
                error: normalized?.message ?? 'Unknown error',
                // Supabase errors carry extra context worth returning for QA.
                details: normalized?.details ?? normalized?.hint ?? undefined,
            },
            { status: 500 },
        );
    }
}
