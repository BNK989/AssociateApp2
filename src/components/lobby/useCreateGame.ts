import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { usePostHog } from 'posthog-js/react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { GAME_MODES } from '@/lib/gameConfig';
import { createLogger, getErrorMessage } from '@/lib/logger';

const log = createLogger('lobby');

/** Supabase has no client-side timeout, so races are wrapped by hand. */
const STEP_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_MESSAGES = 25;

function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timeout`)), STEP_TIMEOUT_MS),
        ),
    ]);
}

/**
 * Creates a game and takes the host straight to its invite screen.
 *
 * Creation is two writes that must both land: the game row, then the host's
 * player row. If the second fails the first is deleted, because a game with no
 * players is unreachable and would sit in the table forever.
 */
export function useCreateGame(user: User | null) {
    const router = useRouter();
    const posthog = usePostHog();
    const [creating, setCreating] = useState(false);

    const createGame = useCallback(async (selectedModeId: string) => {
        if (!user) return;
        setCreating(true);

        try {
            const maxMessages = GAME_MODES.find((m) => m.id === selectedModeId)?.limit
                ?? DEFAULT_MAX_MESSAGES;

            log.debug('create_game', 'Starting game creation', {
                user_id: user.id, mode: selectedModeId, max_messages: maxMessages,
            });

            const { data: game, error: gameError } = await withTimeout(
                supabase
                    .from('games')
                    .insert({
                        status: 'texting',
                        mode: 'free',
                        current_turn_user_id: user.id,
                        max_messages: maxMessages,
                    })
                    .select()
                    .single(),
                'Game creation',
            );

            if (gameError) throw gameError;

            log.debug('create_game', 'Game row created, adding host as player', {
                game_id: game.id, user_id: user.id,
            });

            const { error: playerError } = await withTimeout(
                supabase.from('game_players').insert({
                    game_id: game.id,
                    user_id: user.id,
                    score: 0,
                }),
                'Player insertion',
            );

            if (playerError) {
                // A game with no players can never be joined; roll it back.
                log.error('create_game', 'Host insert failed, rolling back game', {
                    game_id: game.id, user_id: user.id,
                }, playerError);
                await supabase.from('games').delete().eq('id', game.id);
                throw playerError;
            }

            posthog.capture('game_created', {
                game_id: game.id,
                status: 'texting',
                messages_count: 0,
            });

            log.debug('create_game', 'Redirecting to new game', { game_id: game.id });
            router.push(`/game/${game.id}?action=invite`);
            return game.id;
        } catch (error) {
            const message = getErrorMessage(error, 'Failed to create game');
            log.error('create_game', 'Game creation failed', { user_id: user.id }, error);
            toast.error(message);

            if (message.includes('timeout')) {
                toast.error('Connection timed out. Check your internet connection and try again.');
            }
        } finally {
            setCreating(false);
        }
    }, [user, router, posthog]);

    return { creating, createGame };
}
