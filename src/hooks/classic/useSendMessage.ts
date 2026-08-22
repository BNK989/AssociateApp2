import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { calculateMessageValue, calculateNextTurnUserId, generateCipherString } from '@/lib/gameLogic';
import { COMMON_WORDS } from '@/lib/commonWords';
import { createLogger } from '@/lib/logger';
import { validateOutgoingMessage, type MessageRejection } from '@/lib/classicGame/classicRules';
import type { GameState, Message, Player } from './types';

const log = createLogger('game');

const MAX_SEND_RETRIES = 3;
const SEND_TIMEOUT_MS = 10_000;

/** Backoff between send attempts: 0.5s, 1s, 2s. */
const backoffMs = (attempt: number) => 500 * 2 ** attempt;

const REJECTION_MESSAGES: Record<MessageRejection, string> = {
    'empty': '',
    'not-your-turn': "It's not your turn!",
    'word-count': 'Message must be between 1 and 3 words.',
    'too-long': 'Message too long!',
    'duplicate': 'Message already exists in this game!',
};

type UseSendMessageArgs = {
    game: GameState | null;
    user: User | null;
    players: Player[];
    messages: Message[];
    /** Owned by the caller, since the solve path clears it too. */
    input: string;
    setInput: (value: string) => void;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    setGame: React.Dispatch<React.SetStateAction<GameState | null>>;
    onSolveAttempt: () => void;
    markAction: () => void;
    refetch: () => void;
};

/**
 * Sending a word, and seeding a game with a random one.
 *
 * A word is shown immediately and reconciled when the real row arrives, so a
 * turn never feels like it is waiting on the network. Sends retry with backoff
 * because losing a word silently would break the chain for everyone.
 */
export function useSendMessage({
    game,
    user,
    players,
    messages,
    input,
    setInput,
    setMessages,
    setGame,
    onSolveAttempt,
    markAction,
    refetch,
}: UseSendMessageArgs) {
    const [sending, setSending] = useState(false);

    const buildOptimisticMessage = useCallback((content: string, cipher: string): Message => ({
        id: `temp-${Date.now()}`,
        user_id: user!.id,
        content,
        cipher_length: content.length,
        is_solved: false,
        strikes: 0,
        hint_level: 0,
        winner_points: 0,
        author_points: 0,
        created_at: new Date().toISOString(),
        cipher_text: cipher,
        profiles: players.find((p) => p.user_id === user!.id)?.profiles
            ?? { username: user!.email?.split('@')[0] || 'You', avatar_url: '' },
    }), [user, players]);

    const postMessage = useCallback(async (content: string, cipher: string, attempt = 0): Promise<void> => {
        try {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error('Browser is offline');
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

            log.debug('send_message', 'Sending message via server API', {
                game_id: game?.id, user_id: user?.id, attempt: attempt + 1,
            });

            try {
                const response = await fetch('/api/messages/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        game_id: game!.id,
                        content,
                        cipher_length: content.length,
                        cipher_text: cipher,
                        is_solved: false,
                        strikes: 0,
                        hint_level: 0,
                        winner_points: 0,
                        author_points: 0,
                        potentialValue: calculateMessageValue(content),
                    }),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Server error: ${response.status}`);
                }

                // Refresh directly, in case the realtime socket is lagging.
                refetch();
            } finally {
                clearTimeout(timeoutId);
            }
        } catch (error: unknown) {
            const isTimeout = error instanceof Error && error.name === 'AbortError';
            const wrapped = isTimeout ? new Error('Request timed out') : error;

            log.warn('send_message', 'Send attempt failed', {
                game_id: game?.id, user_id: user?.id, attempt: attempt + 1,
            }, wrapped);

            if (attempt < MAX_SEND_RETRIES) {
                await new Promise((r) => setTimeout(r, backoffMs(attempt)));
                return postMessage(content, cipher, attempt + 1);
            }
            throw wrapped;
        }
    }, [game, user, refetch]);

    const submitWord = useCallback(async (content: string) => {
        if (!game || !user) return;

        setSending(true);
        markAction();

        const cipher = generateCipherString(content, 0);
        setMessages((prev) => [...prev, buildOptimisticMessage(content, cipher)]);
        setInput('');

        try {
            await postMessage(content, cipher);

            // Advance the turn locally so the marker moves without waiting.
            const nextPlayerId = players.length > 0
                ? calculateNextTurnUserId(players, user.id)
                : null;
            if (nextPlayerId) {
                setGame((prev) => (prev ? { ...prev, current_turn_user_id: nextPlayerId } : null));
            }
        } catch (error) {
            log.error('send_message', 'Message send failed after all retries', {
                game_id: game.id, user_id: user.id,
            }, error);
            toast.error('Failed to send message. Please check your connection and try again.');
        } finally {
            setSending(false);
        }
    }, [game, user, players, markAction, postMessage, buildOptimisticMessage, setMessages, setGame]);

    const handleSendMessage = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !game || sending) return;

        if (game.status === 'solving') {
            onSolveAttempt();
            return;
        }

        const textMessages = messages.filter((m) => m.type !== 'system');
        const rejection = validateOutgoingMessage({
            input,
            existingContents: textMessages.map((m) => m.content),
            isMyTurn: !game.current_turn_user_id || game.current_turn_user_id === user.id,
            isFirstWord: textMessages.length === 0,
        });

        if (rejection) {
            if (REJECTION_MESSAGES[rejection]) toast.warning(REJECTION_MESSAGES[rejection]);
            return;
        }

        await submitWord(input.trim());
    }, [user, game, sending, messages, input, onSolveAttempt, submitWord]);

    /** Seeds an empty game with a random word so nobody has to go first. */
    const startRandomGame = useCallback(async () => {
        if (!game || !user || sending) return;
        if (messages.some((m) => m.type !== 'system')) return;

        await submitWord(COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)]);
    }, [game, user, sending, messages, submitWord]);

    return { sending, setSending, handleSendMessage, startRandomGame };
}
