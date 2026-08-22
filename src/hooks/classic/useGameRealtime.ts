import { useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { calculateNextTurnUserId } from '@/lib/gameLogic';
import {
    getPointsToShow,
    getStealAnimation,
    isStealEvent,
    mergeIncomingMessage,
} from '@/lib/classicGame/realtimeEvents';
import type { FloatingAnimationData, GameState, Message, Player } from './types';

/** How long a floating points figure stays on screen. */
const POINTS_DISPLAY_MS = 3000;

const PLAYER_SELECT = `
    user_id,
    score,
    joined_at,
    consecutive_correct_guesses,
    has_left,
    profiles:user_id (
        username,
        avatar_url
    )
`;

type UseGameRealtimeArgs = {
    gameId: string;
    user: User | null;
    /** Owned by the caller so the typing broadcaster can share it. */
    channelRef: React.RefObject<ReturnType<typeof supabase.channel> | null>;
    gameRef: React.RefObject<GameState | null>;
    playersRef: React.RefObject<Player[]>;
    setGame: React.Dispatch<React.SetStateAction<GameState | null>>;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
    setJustSolved: (value: { id: string; points: number } | null) => void;
    setFloatingAnimation: (value: FloatingAnimationData | null) => void;
    onTyping: (userId: string) => void;
    onTypingStopped: (userId: string) => void;
    refetch: () => void;
};

/**
 * Live game updates: new words, solves, score changes and typing.
 *
 * Handlers apply changes locally rather than refetching, so play stays
 * responsive; a full refetch is reserved for events that can move several
 * things at once, such as a player leaving.
 */
export function useGameRealtime({
    gameId,
    user,
    gameRef,
    playersRef,
    setGame,
    setMessages,
    setPlayers,
    setJustSolved,
    setFloatingAnimation,
    onTyping,
    onTypingStopped,
    refetch,
    channelRef,
}: UseGameRealtimeArgs) {

    // Held in a ref so changing callbacks never tear down the subscription.
    const handlersRef = useRef({
        setGame, setMessages, setPlayers, setJustSolved,
        setFloatingAnimation, onTyping, onTypingStopped, refetch,
    });
    // Refreshed in an effect rather than during render, so the subscription
    // always calls the latest handlers without being torn down.
    useEffect(() => {
        handlersRef.current = {
            setGame, setMessages, setPlayers, setJustSolved,
            setFloatingAnimation, onTyping, onTypingStopped, refetch,
        };
    });

    useEffect(() => {
        if (!gameId) return;

        const handleInsert = async (row: Message) => {
            const h = handlersRef.current;
            h.onTypingStopped(row.user_id);

            // Prefer the local roster; only hit the DB for a player we have
            // never seen, which is rare and would otherwise block the render.
            let profile = playersRef.current?.find((p) => p.user_id === row.user_id)?.profiles;
            if (!profile) {
                const { data } = await supabase
                    .from('profiles')
                    .select('username, avatar_url')
                    .eq('id', row.user_id)
                    .single();
                if (data) profile = data;
            }

            const message = { ...row, profiles: profile } as Message;
            h.setMessages((prev) => mergeIncomingMessage(prev, message));

            // Rotate the turn locally so the "your turn" marker updates at once.
            h.setGame((prev) => {
                if (!prev || prev.status === 'solving' || prev.status === 'completed') return prev;

                const active = (playersRef.current ?? []).filter((p) => !p.has_left);
                const nextPlayerId = calculateNextTurnUserId(active, row.user_id);

                if (nextPlayerId && prev.current_turn_user_id !== nextPlayerId) {
                    return { ...prev, current_turn_user_id: nextPlayerId };
                }
                return prev;
            });

            // A system message means someone joined or left, which also moves
            // the player list and possibly the turn.
            if (message.type === 'system') h.refetch();
        };

        const handleUpdate = (row: Message) => {
            const h = handlersRef.current;
            h.setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));

            if (!row.is_solved || !user) return;

            if (isStealEvent(row)) {
                const animation = getStealAnimation(row, user.id, playersRef.current ?? []);
                h.setFloatingAnimation({ type: 'steal', ...animation });
            }

            const points = getPointsToShow(row, user.id);
            if (points !== null) {
                h.setJustSolved({ id: row.id, points });
                setTimeout(() => h.setJustSolved(null), POINTS_DISPLAY_MS);
            }
        };

        const channel = supabase
            .channel(`game:${gameId}`)
            .on('broadcast', { event: 'typing' }, (payload) => {
                handlersRef.current.onTyping(payload.payload.user_id);
            })
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'messages', filter: `game_id=eq.${gameId}` },
                async (payload) => {
                    if (payload.eventType === 'INSERT') await handleInsert(payload.new as Message);
                    else if (payload.eventType === 'UPDATE') handleUpdate(payload.new as Message);
                })
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
                (payload) => {
                    const next = payload.new as GameState;
                    const h = handlersRef.current;
                    h.setGame(next);

                    // Announce the switch once, to whoever did not trigger it.
                    if (next.status === 'solving' && gameRef.current?.status !== 'solving') {
                        h.setFloatingAnimation({
                            type: 'announcement',
                            message: 'Solving Mode Activated!',
                            subMessage: 'Try to decipher the past messages',
                        });
                    }
                    if (gameRef.current) gameRef.current = next;
                })
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
                async () => {
                    // Scores and leave flags both land here, so re-read the roster.
                    const { data } = await supabase
                        .from('game_players')
                        .select(PLAYER_SELECT)
                        .eq('game_id', gameId)
                        .order('joined_at', { ascending: true });

                    if (data) handlersRef.current.setPlayers(data as unknown as Player[]);
                })
            .subscribe();

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [gameId, user, gameRef, playersRef, channelRef]);
}
