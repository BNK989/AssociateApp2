import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { calculatePointDistribution, calculateSimilarity } from '@/lib/gameLogic';
import { checkAnswer } from '@/lib/letterPool/answerCheck';
import { createLogger } from '@/lib/logger';
import {
    appendGuess,
    canActOnTarget,
    findTargetMessage,
    getSolveValue,
    getStreakMultiplier,
    MAX_STRIKES,
} from '@/lib/classicGame/classicRules';
import type { FloatingAnimationData, GameState, Message, Player } from './types';
import type { JustSolved } from '@/lib/daily/feedbackTiers';

const log = createLogger('game');

const SOLVED_FLASH_MS = 1500;
const SHAKE_MS = 500;

type UseSolveActionsArgs = {
    game: GameState | null;
    user: User | null;
    players: Player[];
    messages: Message[];
    solvingTimeLeft: number | null;
    setGame: React.Dispatch<React.SetStateAction<GameState | null>>;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    setInput: (value: string) => void;
    setJustSolved: (value: JustSolved | null) => void;
    setFloatingAnimation: (value: FloatingAnimationData | null) => void;
    markAction: () => void;
    refetch: () => void;
};

/**
 * Guessing at the current word, and giving up on it.
 *
 * Both apply optimistically and then tell the server, which is authoritative —
 * the refetch afterwards reconciles anything the client got wrong, such as a
 * race with another player solving first.
 */
export function useSolveActions({
    game,
    user,
    players,
    messages,
    solvingTimeLeft,
    setGame,
    setMessages,
    setInput,
    setJustSolved,
    setFloatingAnimation,
    markAction,
    refetch,
}: UseSolveActionsArgs) {
    const [shakeMessageId, setShakeMessageId] = useState<string | null>(null);

    const getTarget = useCallback(() => findTargetMessage(messages), [messages]);

    /** Shared gate: is this word mine to act on right now? */
    const guardTarget = useCallback((target: Message): boolean => {
        const author = players.find((p) => p.user_id === target.user_id);

        if (!canActOnTarget({
            authorId: target.user_id,
            currentUserId: user?.id,
            solvingTimeLeft,
            authorHasLeft: author?.has_left || false,
        })) {
            toast.warning('Wait for the author or the free-for-all!');
            return false;
        }
        return true;
    }, [players, user?.id, solvingTimeLeft]);

    const postAction = useCallback((action: string, payload: Record<string, unknown>) => {
        if (!game) return Promise.resolve();

        return fetch(`/api/game/${game.id}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload }),
        }).then(() => refetch());
    }, [game, refetch]);

    const handleSolveAttempt = useCallback(async (input: string) => {
        if (!game || !user) return;

        const target = getTarget();
        if (!target) {
            toast.info('All active messages solved or lost!');
            return;
        }
        if (!guardTarget(target)) return;

        markAction();

        // Exact once the strip is supplying the shape — from hint level 1 in a
        // room, since `isSinglePlayer` is only ever set by the daily game.
        // `similarity` still scales the award below; only the pass/fail
        // decision moves, so a near-miss cannot be paid as a solve.
        const similarity = calculateSimilarity(input, target.content);
        // `isSinglePlayer` is only ever set by the daily game, so in a room
        // the strip arrives with the first hint.
        const isMatch = checkAnswer(input, target.content, {
            hintLevel: target.hint_level || 0, isSinglePlayer: false,
        });

        if (!isMatch) {
            const strikes = (target.strikes || 0) + 1;

            // The guess is the letter feedback. Recorded optimistically here so
            // the colours land with the shake rather than a round-trip later,
            // and again on the server, which is what survives the refetch.
            setMessages((prev) => prev.map((m) => (m.id === target.id
                ? {
                    ...m,
                    strikes,
                    guesses: appendGuess(m.guesses, input),
                    is_solved: strikes >= MAX_STRIKES ? true : m.is_solved,
                }
                : m)));

            setShakeMessageId(target.id);
            setTimeout(() => setShakeMessageId(null), SHAKE_MS);

            if (strikes >= MAX_STRIKES) {
                toast.error(`Word lost! The word was "${target.content}"`);
            }

            setInput('');
            await postAction('solve_attempt', {
                targetId: target.id,
                isMatch: false,
                strikes: target.strikes || 0,
                guess: input,
            });
            return;
        }

        const value = getSolveValue(target.content, target.hint_level, similarity);
        const consecutive = (players.find((p) => p.user_id === user.id)?.consecutive_correct_guesses || 0) + 1;
        const multiplier = getStreakMultiplier(consecutive, game.fever_mode_remaining);
        const distribution = calculatePointDistribution(value, user.id, target.user_id, multiplier);
        const isSteal = distribution.type === 'STEAL';

        // Restart the window locally so a slow round-trip cannot let the word
        // fall into free-for-all while the solve is still in flight.
        setGame((prev) => (prev ? { ...prev, solving_started_at: new Date().toISOString() } : prev));

        setMessages((prev) => prev.map((m) => (m.id === target.id ? {
            ...m,
            is_solved: true,
            solved_by: user.id,
            winner_points: distribution.winnerPoints,
            author_points: isSteal ? distribution.authorPoints : 0,
        } : m)));

        setJustSolved({ id: target.id, points: distribution.winnerPoints });
        setTimeout(() => setJustSolved(null), SOLVED_FLASH_MS);

        if (isSteal) {
            const authorName = target.user_id === user.id
                ? 'You'
                : players.find((p) => p.user_id === target.user_id)?.profiles?.username || 'Unknown';

            setFloatingAnimation({
                type: 'steal',
                stealerName: 'You',
                stealerAvatar: players.find((p) => p.user_id === user.id)?.profiles?.avatar_url,
                authorName,
            });
        }

        setInput('');
        await postAction('solve_attempt', {
            targetId: target.id,
            isMatch: true,
            winnerPoints: distribution.winnerPoints,
            authorPoints: isSteal ? distribution.authorPoints : 0,
            type: distribution.type,
            targetUserId: target.user_id,
            consecutive,
        });
    }, [
        game, user, players, getTarget, guardTarget, markAction, postAction,
        setGame, setMessages, setInput, setJustSolved, setFloatingAnimation,
    ]);

    const handleGiveUp = useCallback(async () => {
        if (!game || !user) return;

        const target = getTarget();
        if (!target || !guardTarget(target)) return;

        setMessages((prev) => prev.map((m) => (m.id === target.id
            ? { ...m, is_solved: true, solved_by: user.id, winner_points: 0 }
            : m)));
        setInput('');

        try {
            await postAction('give_up', { targetId: target.id, userId: user.id });
        } catch (error) {
            log.error('give_up', 'Failed to give up on word', {
                game_id: game.id, user_id: user.id,
            }, error);
        }
    }, [game, user, getTarget, guardTarget, postAction, setMessages, setInput]);

    return { getTargetMessage: getTarget, handleSolveAttempt, handleGiveUp, shakeMessageId };
}
