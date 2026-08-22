import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { supabase } from '@/lib/supabase';
import { useGameData } from './classic/useGameData';
import { useGameRealtime } from './classic/useGameRealtime';
import { useGameTimers } from './classic/useGameTimers';
import { useHintAction } from './classic/useHintAction';
import { useSendMessage } from './classic/useSendMessage';
import { useSolveActions } from './classic/useSolveActions';
import { useSolveProposal } from './classic/useSolveProposal';
import { useTypingIndicator } from './classic/useTypingIndicator';
import type { FloatingAnimationData } from './classic/types';

export type { FloatingAnimationData, GameState, Message, Player } from './classic/types';

/** Backstop refresh, in case a realtime event is missed. */
const POLL_INTERVAL_MS = 5000;

/** Skip a poll this soon after acting, so it cannot overwrite an optimistic update. */
const POLL_QUIET_MS = 4000;

/**
 * The classic multiplayer game: state, realtime sync, and every move a player
 * can make.
 *
 * Play is optimistic — moves apply locally and are then confirmed by the
 * server, which stays authoritative. Realtime carries the updates; the poll is
 * only a safety net for a dropped socket.
 */
export function useGameLogic(gameId: string) {
    const { user, loading: authLoading } = useAuth();

    const {
        game, setGame, gameRef,
        messages, setMessages,
        players, setPlayers, playersRef,
        loading, fetchGameData,
    } = useGameData(gameId, user);

    const [input, setInput] = useState('');
    const [justSolvedData, setJustSolved] = useState<{ id: string; points: number } | null>(null);
    const [floatingAnimation, setFloatingAnimation] = useState<FloatingAnimationData | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Polling backs off briefly after a move so it cannot clobber local state.
    const lastActionTime = useRef(0);
    const markAction = useCallback(() => { lastActionTime.current = Date.now(); }, []);

    const { proposalTimeLeft, solvingTimeLeft } = useGameTimers(game);

    // Owned here so the typing broadcaster and the subscription can share it
    // without either having to be declared first.
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const typing = useTypingIndicator(user, channelRef);

    useGameRealtime({
        gameId,
        user,
        channelRef,
        gameRef,
        playersRef,
        setGame,
        setMessages,
        setPlayers,
        setJustSolved,
        setFloatingAnimation,
        onTyping: typing.markTyping,
        onTypingStopped: typing.stopTyping,
        refetch: fetchGameData,
    });

    const solve = useSolveActions({
        game, user, players, messages, solvingTimeLeft,
        setGame, setMessages, setInput,
        setJustSolved, setFloatingAnimation,
        markAction, refetch: fetchGameData,
    });

    // Sending a word while solving is really a guess. Routed through a ref
    // because the two hooks would otherwise have to be declared before
    // each other.
    const solveWithInput = useRef<(value: string) => void>(() => { });
    useEffect(() => {
        solveWithInput.current = solve.handleSolveAttempt;
    }, [solve.handleSolveAttempt]);

    const send = useSendMessage({
        game, user, players, messages,
        input, setInput,
        setMessages, setGame,
        onSolveAttempt: () => solveWithInput.current(input),
        markAction, refetch: fetchGameData,
    });

    const proposal = useSolveProposal({ game, user, markAction, refetch: fetchGameData });

    const handleGetHint = useHintAction({
        game, user, players, solvingTimeLeft,
        sending: send.sending, setSending: send.setSending,
        getTargetMessage: solve.getTargetMessage,
        setMessages, markAction, refetch: fetchGameData,
    });

    useEffect(() => {
        if (authLoading || !user || !gameId) return;

        fetchGameData();

        const poll = setInterval(() => {
            const sinceAction = Date.now() - lastActionTime.current;
            if (document.visibilityState === 'visible' && sinceAction > POLL_QUIET_MS) {
                fetchGameData();
            }
        }, POLL_INTERVAL_MS);

        return () => clearInterval(poll);
    }, [user, gameId, authLoading, fetchGameData]);

    return {
        user,
        game,
        messages,
        players,
        input,
        setInput,
        loading,
        messagesEndRef,
        proposalTimeLeft,
        solvingTimeLeft,
        sending: send.sending,
        fetchGameData,
        handleSendMessage: send.handleSendMessage,
        startRandomGame: send.startRandomGame,
        proposeSolvingMode: proposal.proposeSolvingMode,
        denySolvingMode: proposal.denySolvingMode,
        confirmSolvingMode: proposal.confirmSolvingMode,
        handleGetHint,
        getTargetMessage: solve.getTargetMessage,
        handleGiveUp: solve.handleGiveUp,
        shakeMessageId: solve.shakeMessageId,
        justSolvedData,
        broadcastTyping: typing.broadcastTyping,
        typingUsers: typing.typingUsers,
        floatingAnimation,
        setFloatingAnimation,
    };
}
