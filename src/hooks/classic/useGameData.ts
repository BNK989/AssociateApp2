import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';
import type { GameState, Message, Player } from './types';

const log = createLogger('game');

/** Initial-load retries, for a cold start racing the session cookie. */
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * The authoritative game snapshot, fetched from the state endpoint.
 *
 * Reads go through the API rather than Supabase directly so the server can
 * assemble the joined shape once. A player who is not in the game is bounced
 * home — the row-level policies let them read it, but they should not be here.
 */
export function useGameData(gameId: string, user: User | null) {
    const router = useRouter();
    const [game, setGame] = useState<GameState | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);

    // Read inside callbacks without making them depend on the value.
    const gameRef = useRef<GameState | null>(null);
    const playersRef = useRef<Player[]>([]);

    const fetchGameData = useCallback(async (retryCount = 0): Promise<void> => {
        if (!gameId) return;

        try {
            const response = await fetch(`/api/game/${gameId}/state`, { cache: 'no-store' });

            if (!response.ok) {
                if (response.status === 401) {
                    log.error('fetch_state', 'Unauthorized when fetching game state, session may have expired', {
                        game_id: gameId, user_id: user?.id,
                    });
                    return;
                }
                throw new Error(`Fetch failed: ${response.status}`);
            }

            const data = await response.json();

            setGame(data.game);
            gameRef.current = data.game;
            setPlayers(data.players || []);
            playersRef.current = data.players || [];
            setMessages(data.messages || []);
            setLoading(false);

            if (user && data.players && !data.players.some((p: Player) => p.user_id === user.id)) {
                toast.error('You are not part of this game!');
                router.push('/');
            }
        } catch (error) {
            log.error('fetch_state', 'Failed to fetch game state', {
                game_id: gameId, user_id: user?.id, retry_count: retryCount,
            }, error);

            // Only the very first load retries; a failed poll is silently ignored
            // because the next tick will try again anyway.
            if (!gameRef.current && retryCount < MAX_RETRIES) {
                log.debug('fetch_state', 'Retrying fetch', {
                    game_id: gameId, attempt: retryCount + 1, max_attempts: MAX_RETRIES,
                });
                setTimeout(() => fetchGameData(retryCount + 1), RETRY_DELAY_MS);
                return;
            }

            setLoading(false);
        }
    }, [gameId, user, router]);

    return {
        game, setGame, gameRef,
        messages, setMessages,
        players, setPlayers, playersRef,
        loading,
        fetchGameData,
    };
}
