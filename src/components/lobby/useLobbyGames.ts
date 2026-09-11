import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { createLogger, isAbortError } from '@/lib/logger';
import { formatLobbyGames } from './formatLobbyGames';
import type { LobbyGame, LobbyGameRow } from './types';

const log = createLogger('lobby');

/** Retries allowed after a cancelled fetch, before the lobby gives up quietly. */
const ABORT_RETRIES = 1;

/** Long enough for a resumed tab to settle, short enough not to be noticed. */
const ABORT_RETRY_DELAY_MS = 400;

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

    /**
     * Which fetch is the current one.
     *
     * The lobby refetches from four places — mount, window focus, and a
     * realtime subscription on each of `games` and `game_players` — so a single
     * action can easily have several in flight at once. Without this, whichever
     * happens to land last wins, which need not be the newest.
     */
    const requestRef = useRef(0);

    /**
     * One retry per cancellation, so a swallowed abort cannot leave the lobby
     * looking empty.
     *
     * Hiding the error is only half the fix: if the *first* fetch is the one
     * that gets cancelled, there is nothing on screen and nothing scheduled to
     * try again, and "no games yet" is a worse lie than the error was. Bounded
     * at one so a persistent cancellation cannot spin.
     */
    const retriesRef = useRef(0);
    const fetchRef = useRef<() => void>(() => {});

    const fetchGames = useCallback(async () => {
        if (!user) return;

        const request = requestRef.current + 1;
        requestRef.current = request;

        setLoading(true);
        log.debug('fetch_games', 'Fetching games for user', { user_id: user.id });

        const { data, error } = await supabase
            .from('games')
            .select(LOBBY_QUERY)
            .eq('game_players.user_id', user.id)
            .order('last_activity_at', { ascending: false, nullsFirst: false });

        // A fetch that has been superseded says nothing about the lobby: its
        // answer is stale by definition, and its errors are usually the abort
        // that superseded it.
        if (request !== requestRef.current) return;

        if (error) {
            // A cancelled request is not a failed one. The browser aborts
            // in-flight fetches when a tab is frozen or a page navigates, and
            // reporting that as "loading games failed" tells the player
            // something broke when nothing did -- with a message
            // ("signal is aborted without reason") that they can act on even
            // less. The next focus or realtime event refetches anyway.
            if (isAbortError(error)) {
                const willRetry = retriesRef.current < ABORT_RETRIES;
                log.debug('fetch_games', 'Games fetch was cancelled, not failed', {
                    user_id: user.id,
                    reason: error.message,
                    will_retry: willRetry,
                });

                if (willRetry) {
                    retriesRef.current += 1;
                    setTimeout(() => fetchRef.current(), ABORT_RETRY_DELAY_MS);
                    return;
                }

                setLoading(false);
                return;
            }

            log.error('fetch_games', 'Failed to load games', { user_id: user.id }, error);
            toast.error(t('toasts.load_error', { message: error.message }));
            setLoading(false);
            return;
        }

        retriesRef.current = 0;

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
        fetchRef.current = fetchGames;
    }, [fetchGames]);


    /**
     * Subscribes once per user, and reaches the fetch through a ref.
     *
     * Depending on `fetchGames` directly is a trap. It is rebuilt whenever `t`
     * or `user` changes identity, and every rebuild tore down the realtime
     * channel, re-subscribed, and fired another fetch — while the fetch itself
     * sets state, so an unstable `t` turns the pair into a render loop. A test
     * with a per-render `t` produced 180 requests before it was caught.
     *
     * next-intl's `t` is stable in practice, so this was latent rather than
     * live; the effect no longer relies on that being true.
     */
    useEffect(() => {
        if (!user) return;

        const refetch = () => fetchRef.current();

        refetch();

        const handleFocus = () => {
            log.debug('window_focus', 'Window focused, refreshing lobby');
            refetch();
        };
        window.addEventListener('focus', handleFocus);

        const channel = supabase
            .channel('lobby_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, refetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players' }, refetch)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('focus', handleFocus);
        };
    }, [user]);

    return { activeGames, completedGames, loading, refetch: fetchGames };
}
