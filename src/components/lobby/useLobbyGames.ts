import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import { formatLobbyGames } from './formatLobbyGames';
import type { LobbyGame, LobbyGameRow } from './types';

const log = createLogger('lobby');

/**
 * `game_players!inner` filters to the current player so the row carries their
 * own membership flags; `players` re-joins unfiltered for the avatar row.
 */
const LOBBY_QUERY = `
    *,
    messages(count),
    game_players!inner (user_id, is_archived, has_left),
    players:game_players (
        has_left,
        user:profiles (username, avatar_url)
    )
`;

/**
 * The player's games, kept current via realtime and a window-focus refetch.
 *
 * The focus listener exists because browser back-navigation restores a cached
 * page without remounting, which would otherwise leave a stale lobby.
 */
export function useLobbyGames(user: User | null) {
    const t = useTranslations('Lobby');
    const [activeGames, setActiveGames] = useState<LobbyGame[]>([]);
    const [completedGames, setCompletedGames] = useState<LobbyGame[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchGames = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        log.debug('fetch_games', 'Fetching games for user', { user_id: user.id });

        const { data, error } = await supabase
            .from('games')
            .select(LOBBY_QUERY)
            .eq('game_players.user_id', user.id)
            .order('last_activity_at', { ascending: false, nullsFirst: false });

        if (error) {
            log.error('fetch_games', 'Failed to load games', { user_id: user.id }, error);
            toast.error(t('toasts.load_error', { message: error.message }));
            setLoading(false);
            return;
        }

        const rows = (data ?? []) as unknown as LobbyGameRow[];
        const { active, completed } = formatLobbyGames(rows, user.id);

        log.debug('fetch_games', 'Games fetched', {
            user_id: user.id,
            count: rows.length,
            active: active.length,
            completed: completed.length,
        });

        setActiveGames(active);
        setCompletedGames(completed);
        setLoading(false);
    }, [user, t]);

    useEffect(() => {
        if (!user) return;

        fetchGames();

        const handleFocus = () => {
            log.debug('window_focus', 'Window focused, refreshing lobby');
            fetchGames();
        };
        window.addEventListener('focus', handleFocus);

        const channel = supabase
            .channel('lobby_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => fetchGames())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players' }, () => fetchGames())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('focus', handleFocus);
        };
    }, [user, fetchGames]);

    return { activeGames, completedGames, loading, refetch: fetchGames };
}
