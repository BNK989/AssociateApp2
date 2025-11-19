import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { toast } from "sonner";

export type Message = {
    id: string;
    content: string;
    cipher_length: number;
    is_solved: boolean;
    user_id: string;
    created_at: string;
    profiles?: {
        username: string;
        avatar_url: string;
    };
};

export type GameState = {
    id: string;
    status: 'lobby' | 'active' | 'solving' | 'completed';
    mode: 'free' | '100_text';
    current_turn_user_id: string;
    solving_proposal_created_at?: string | null;
    solving_started_at?: string | null;
};

export type Player = {
    user_id: string;
    score: number;
    joined_at: string;
    profiles?: {
        username: string;
        avatar_url: string;
    };
};

export function useGameLogic(gameId: string) {
    const { user } = useAuth();
    const router = useRouter();
    const [game, setGame] = useState<GameState | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [proposalTimeLeft, setProposalTimeLeft] = useState<number | null>(null);
    const [solvingTimeLeft, setSolvingTimeLeft] = useState<number | null>(null);
    const [sending, setSending] = useState(false);

    const fetchGameData = async () => {
        if (!gameId) return;

        // Fetch Game
        const { data: gameData, error: gameError } = await supabase
            .from('games')
            .select('*')
            .eq('id', gameId)
            .single();

        if (gameError) {
            console.error('Error fetching game:', gameError);
            return;
        }
        setGame(gameData);

        // Fetch Players
        const { data: playersData, error: playersError } = await supabase
            .from('game_players')
            .select(`
                user_id,
                score,
                joined_at,
                profiles:user_id (
                    username,
                    avatar_url
                )
            `)
            .eq('game_id', gameId)
            .order('joined_at', { ascending: true });

        if (playersError) {
            console.error('Error fetching players:', playersError);
        } else {
            setPlayers(playersData || []);
        }

        // Fetch Messages with Profiles
        const { data: msgs, error: msgError } = await supabase
            .from('messages')
            .select(`
                *,
                profiles:user_id (
                    username,
                    avatar_url
                )
            `)
            .eq('game_id', gameId)
            .order('created_at', { ascending: true });

        if (msgError) {
            console.error('Error fetching messages:', msgError);
        } else {
            setMessages(msgs as unknown as Message[] || []);
        }
        setLoading(false);
    };

    const subscribeToGame = () => {
        const channel = supabase
            .channel(`game:${gameId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async (payload) => {
                if (payload.eventType === 'INSERT') {
                    // Fetch profile for the new message
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('username, avatar_url')
                        .eq('id', payload.new.user_id)
                        .single();

                    const newMessage = { ...payload.new, profiles: profile } as unknown as Message;
                    setMessages(prev => [...prev, newMessage]);
                } else if (payload.eventType === 'UPDATE') {
                    setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
                setGame(payload.new as GameState);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, async (payload) => {
                // Fetch profile of the new player
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('id', payload.new.user_id)
                    .single();

                if (profile) {
                    toast.info(`${profile.username} has joined the chat!`);
                    // Refresh players list
                    const { data: newPlayers } = await supabase
                        .from('game_players')
                        .select(`
                            user_id,
                            score,
                            joined_at,
                            profiles:user_id (
                                username,
                                avatar_url
                            )
                        `)
                        .eq('game_id', gameId)
                        .order('joined_at', { ascending: true });
                    if (newPlayers) setPlayers(newPlayers);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    useEffect(() => {
        if (!user || !gameId) return;
        fetchGameData();
        const cleanup = subscribeToGame();
        return () => {
            cleanup();
        };
    }, [user, gameId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Timer for Proposal
    useEffect(() => {
        if (!game?.solving_proposal_created_at) {
            setProposalTimeLeft(null);
            return;
        }

        const interval = setInterval(() => {
            const created = new Date(game.solving_proposal_created_at!).getTime();
            const now = Date.now();
            const diff = 10000 - (now - created); // 10 seconds

            if (diff <= 0) {
                setProposalTimeLeft(0);
                clearInterval(interval);
                if (game.status !== 'solving') {
                    confirmSolvingMode();
                }
            } else {
                setProposalTimeLeft(Math.ceil(diff / 1000));
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [game?.solving_proposal_created_at, game?.status]);

    // Timer for Solving Mode (20s rule)
    useEffect(() => {
        if (game?.status !== 'solving' || !game?.solving_started_at) {
            setSolvingTimeLeft(null);
            return;
        }

        const interval = setInterval(() => {
            const started = new Date(game.solving_started_at!).getTime();
            const now = Date.now();
            const diff = 20000 - (now - started); // 20 seconds

            if (diff <= 0) {
                setSolvingTimeLeft(0);
                clearInterval(interval);
            } else {
                setSolvingTimeLeft(Math.ceil(diff / 1000));
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [game?.status, game?.solving_started_at]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const getTargetMessage = () => {
        const reversed = [...messages].reverse();
        return reversed.find(m => !m.is_solved);
    };

    const handleSolveAttempt = async () => {
        if (!game || !user) return;

        const target = getTargetMessage();
        if (!target) {
            toast.info("All messages solved!");
            return;
        }

        const isFreeForAll = solvingTimeLeft === 0;
        const isMyTurn = target.user_id === user.id;

        if (!isFreeForAll && !isMyTurn) {
            toast.warning("Wait for the author or the free-for-all!");
            return;
        }

        const guess = input.trim().toLowerCase();
        const actual = target.content.toLowerCase();

        if (guess === actual) {
            toast.success("Correct! You solved the message!");

            await supabase
                .from('messages')
                .update({ is_solved: true })
                .eq('id', target.id);

            await supabase
                .from('games')
                .update({ solving_started_at: new Date().toISOString() })
                .eq('id', game.id);

            setInput('');
        } else {
            toast.error("Incorrect guess!");
            setInput('');
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !user || !game || sending) return;

        if (game.status === 'solving') {
            handleSolveAttempt();
            return;
        }

        // Turn Logic Check - user can only send if it's their turn
        if (game.current_turn_user_id && game.current_turn_user_id !== user.id) {
            toast.warning("It's not your turn!");
            return;
        }

        // Validation (Word count)
        const wordCount = input.trim().split(/\s+/).length;
        if (wordCount < GAME_CONFIG.MESSAGE_WORD_LIMIT_MIN || wordCount > GAME_CONFIG.MESSAGE_WORD_LIMIT_MAX) {
            alert(`Message must be between ${GAME_CONFIG.MESSAGE_WORD_LIMIT_MIN} and ${GAME_CONFIG.MESSAGE_WORD_LIMIT_MAX} words.`);
            return;
        }

        setSending(true);

        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    game_id: game.id,
                    user_id: user.id,
                    content: input.trim(),
                    cipher_length: input.trim().length,
                    is_solved: false
                });

            if (error) {
                console.error('Error sending message:', error);
                toast.error("Failed to send message");
                return;
            }

            setInput('');

            // Calculate Next Turn
            if (players.length > 0) {
                const currentIndex = players.findIndex(p => p.user_id === user.id);
                if (currentIndex !== -1) {
                    const nextIndex = (currentIndex + 1) % players.length;
                    const nextPlayerId = players[nextIndex].user_id;

                    // Optimistic Update - immediately update local state
                    setGame(prev => prev ? ({ ...prev, current_turn_user_id: nextPlayerId }) : null);

                    const { error: updateError } = await supabase
                        .from('games')
                        .update({ current_turn_user_id: nextPlayerId })
                        .eq('id', game.id);

                    if (updateError) {
                        console.error("Error updating turn:", updateError);
                        toast.error("Failed to update turn");
                    }
                }
            }
        } finally {
            setSending(false);
        }
    };

    const proposeSolvingMode = async () => {
        if (!game) return;
        const { error } = await supabase
            .from('games')
            .update({ solving_proposal_created_at: new Date().toISOString() })
            .eq('id', game.id);
        if (error) console.error("Error proposing:", error);
    };

    const denySolvingMode = async () => {
        if (!game) return;
        const { error } = await supabase
            .from('games')
            .update({ solving_proposal_created_at: null })
            .eq('id', game.id);
        if (error) console.error("Error denying:", error);
    };

    const confirmSolvingMode = async () => {
        if (!game) return;
        const { error } = await supabase
            .from('games')
            .update({
                status: 'solving',
                solving_proposal_created_at: null,
                solving_started_at: new Date().toISOString()
            })
            .eq('id', game.id);
        if (error) console.error("Error confirming mode:", error);
    };

    const handleGetHint = async () => {
        if (!game || game.status !== 'solving') return;

        const reversed = [...messages].reverse();
        const target = reversed.find(m => !m.is_solved);

        if (!target) {
            toast.info("All messages solved!");
            return;
        }

        const toastId = toast.loading("Asking Gemini for a hint...");

        try {
            const response = await fetch('/api/hint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameId: game.id,
                    targetMessageId: target.id
                })
            });

            const data = await response.json();

            if (data.error) {
                toast.error(`Error: ${data.error}`, { id: toastId });
            } else {
                toast.success(data.hint, {
                    duration: 5000,
                    id: toastId,
                    icon: '💡'
                });
            }
        } catch (error) {
            console.error("Hint error:", error);
            toast.error("Failed to get hint", { id: toastId });
        }
    };

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
        sending,
        fetchGameData,
        handleSendMessage,
        proposeSolvingMode,
        denySolvingMode,
        handleGetHint,
        getTargetMessage
    };
}
