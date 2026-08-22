import { useCallback } from 'react';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { generateCipherString } from '@/lib/gameLogic';
import { createLogger } from '@/lib/logger';
import { canActOnTarget } from '@/lib/classicGame/classicRules';
import { MAX_HINT_LEVEL } from '@/lib/daily/dailyScoring';
import type { GameState, Message, Player } from './types';

const log = createLogger('game');

type UseHintActionArgs = {
    game: GameState | null;
    user: User | null;
    players: Player[];
    solvingTimeLeft: number | null;
    sending: boolean;
    setSending: (value: boolean) => void;
    getTargetMessage: () => Message | undefined;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    markAction: () => void;
    refetch: () => void;
};

/**
 * Buys the next hint level on the current word.
 *
 * The AI clue is withheld from guests because it costs a paid API call. The
 * `sending` flag is checked here as well as by the caller: buying a hint and
 * submitting a guess at the same moment would race for the same word.
 */
export function useHintAction({
    game,
    user,
    players,
    solvingTimeLeft,
    sending,
    setSending,
    getTargetMessage,
    setMessages,
    markAction,
    refetch,
}: UseHintActionArgs) {
    return useCallback(async () => {
        if (!game || game.status !== 'solving' || sending) return;

        const target = getTargetMessage();
        if (!target) {
            toast.info('No active message to hint!');
            return;
        }

        const nextLevel = (target.hint_level || 0) + 1;
        if (nextLevel > MAX_HINT_LEVEL) {
            toast.info('Max hints used!');
            return;
        }

        if (nextLevel === MAX_HINT_LEVEL && user?.is_anonymous) {
            toast.info('Register to get AI hints!');
            return;
        }

        const author = players.find((p) => p.user_id === target.user_id);
        if (!canActOnTarget({
            authorId: target.user_id,
            currentUserId: user?.id,
            solvingTimeLeft,
            authorHasLeft: author?.has_left || false,
        })) {
            toast.warning('Wait for the author or the free-for-all!');
            return;
        }

        setSending(true);
        markAction();

        try {
            // Levels 1 and 2 regenerate the mask; level 3 adds a clue on top of
            // whatever is already revealed, so the mask is preserved.
            const newCipherText = nextLevel < MAX_HINT_LEVEL
                ? generateCipherString(target.content, nextLevel)
                : (target.cipher_text || generateCipherString(target.content, 2));

            setMessages((prev) => prev.map((m) => (m.id === target.id
                ? { ...m, hint_level: nextLevel, cipher_text: newCipherText }
                : m)));

            const res = await fetch(`/api/game/${game.id}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'get_hint',
                    payload: { targetId: target.id, nextLevel, newCipherText },
                }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.ai_hint) {
                    setMessages((prev) => prev.map((m) => (m.id === target.id
                        ? { ...m, ai_hint: data.ai_hint }
                        : m)));
                }
            }

            refetch();
        } catch (error) {
            log.error('get_hint', 'Failed to buy hint', { game_id: game.id, user_id: user?.id }, error);
            toast.error('Failed to buy hint');
        } finally {
            setSending(false);
        }
    }, [
        game, user, players, solvingTimeLeft, sending,
        setSending, getTargetMessage, setMessages, markAction, refetch,
    ]);
}
