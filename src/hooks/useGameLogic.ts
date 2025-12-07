import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { GAME_CONFIG } from '@/lib/gameConfig';
import {
    calculateMessageValue,
    calculateSimilarity,
    calculatePointDistribution,
    generateCipherString,
    HINT_COSTS
} from '@/lib/gameLogic';
import { toast } from "sonner";

export type Message = {
    id: string;
    content: string;
    cipher_length: number;
    is_solved: boolean;
    user_id: string;
    created_at: string;
    strikes: number;
    hint_level: number;
    cipher_text?: string;
    solved_by?: string;
    profiles?: {
        username: string;
        avatar_url: string;
    };
};

export type GameState = {
    id: string;
    status: 'lobby' | 'texting' | 'active' | 'solving' | 'completed';
    mode: 'free' | '100_text';
    current_turn_user_id: string;
    solving_proposal_created_at?: string | null;
    solving_started_at?: string | null;
    team_pot: number;
    team_consecutive_correct: number;
    fever_mode_remaining: number;
    solve_proposal_confirmations: string[];
};

export type Player = {
    user_id: string;
    score: number;
    joined_at: string;
    consecutive_correct_guesses: number;
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
    const [shakeMessageId, setShakeMessageId] = useState<string | null>(null);

    const [justSolvedData, setJustSolvedMessageId] = useState<{ id: string; points: number } | null>(null);

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
            toast.error("Game not found");
            router.push('/');
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
                consecutive_correct_guesses,
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
            setPlayers((playersData as unknown as Player[]) || []);
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

        // Access Control: Check if current user is a player
        if (user && playersData) {
            const isPlayer = (playersData as unknown as Player[]).some(p => p.user_id === user.id);
            if (!isPlayer) {
                toast.error("You are not part of this game!");
                router.push('/');
            }
        }
    };

    const subscribeToGame = () => {
        const channel = supabase
            .channel(`game:${gameId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async (payload) => {
                if (payload.eventType === 'INSERT') {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('username, avatar_url')
                        .eq('id', payload.new.user_id)
                        .single();

                    const newMessage = { ...payload.new, profiles: profile } as unknown as Message;
                    setMessages(prev => [...prev, newMessage]);
                } else if (payload.eventType === 'UPDATE') {
                    const updatedMessage = payload.new as any;
                    setMessages(prev => prev.map(m => m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m));

                    // Trigger Animation for Realtime Updates (e.g. for the Author, or if Guesser's local update missed)
                    // We only trigger if it just became solved
                    if (updatedMessage.is_solved && user) {
                        // Check if I am the winner
                        if (updatedMessage.solved_by === user.id) {
                            // Guesser already handled locally, but we can ensure sync or ignore.
                            // Local update typically covers this.
                        }
                        // Check if I am the author
                        if (updatedMessage.user_id === user.id && updatedMessage.author_points > 0) {
                            setJustSolvedMessageId({ id: updatedMessage.id, points: updatedMessage.author_points });
                            setTimeout(() => setJustSolvedMessageId(null), 3000);
                            toast.success(`Your message was solved! +${updatedMessage.author_points} pts`);
                        }
                    }
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
                setGame(payload.new as GameState);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, async (payload) => {
                // Refresh players list on any player update (score changes etc)
                const { data: newPlayers } = await supabase
                    .from('game_players')
                    .select(`
                        user_id,
                        score,
                        joined_at,
                        consecutive_correct_guesses,
                        profiles:user_id (
                            username,
                            avatar_url
                        )
                    `)
                    .eq('game_id', gameId)
                    .order('joined_at', { ascending: true });
                if (newPlayers) setPlayers(newPlayers as unknown as Player[]);
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

    const finalizeSolvingMode = useCallback(async () => {
        if (!game) return;
        const { error } = await supabase
            .from('games')
            .update({
                status: 'solving',
                solving_proposal_created_at: null,
                solving_started_at: new Date().toISOString()
            })
            .eq('id', game.id);
        if (error) console.error("Error finalizing mode:", error);
    }, [game]);

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
                    finalizeSolvingMode();
                }
            } else {
                setProposalTimeLeft(Math.ceil(diff / 1000));
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [game?.solving_proposal_created_at, game?.status, finalizeSolvingMode]);

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
        // Skip messages with 3 strikes as they are "lost"
        return reversed.find(m => !m.is_solved && (m.strikes || 0) < 3);
    };

    const handleSolveAttempt = async () => {
        if (!game || !user) return;

        const target = getTargetMessage();
        if (!target) {
            toast.info("All active messages solved or lost!");
            return;
        }

        const isFreeForAll = solvingTimeLeft === 0;
        const isMyTurn = target.user_id === user.id;

        if (!isFreeForAll && !isMyTurn) {
            toast.warning("Wait for the author or the free-for-all!");
            return;
        }

        // Fuzzy Match Check
        const similarity = calculateSimilarity(input, target.content);
        const isMatch = similarity >= 0.8;

        if (isMatch) {
            // Calculate Message Value
            const baseValue = calculateMessageValue(target.content);
            let deductionMultiplier = 0;
            if (target.hint_level === 1) deductionMultiplier = HINT_COSTS.TIER_1;
            else if (target.hint_level === 2) deductionMultiplier = HINT_COSTS.TIER_1 + HINT_COSTS.TIER_2;
            else if (target.hint_level === 3) deductionMultiplier = HINT_COSTS.TIER_1 + HINT_COSTS.TIER_2 + HINT_COSTS.TIER_3;

            // Apply minor penalty for imperfect match
            const accuracyPenalty = similarity < 1.0 ? 0.1 : 0;

            const finalValue = Math.floor(baseValue * (1 - deductionMultiplier - accuracyPenalty));

            // Multiplier Logic (Hot Hand + Fever Mode)
            const currentPlayer = players.find(p => p.user_id === user.id);
            const consecutive = (currentPlayer?.consecutive_correct_guesses || 0) + 1;

            let multiplier = 1;
            if (consecutive >= 4) multiplier = 2;
            else if (consecutive === 3) multiplier = 1.5;
            else if (consecutive === 2) multiplier = 1.2;

            if (game.fever_mode_remaining > 0) {
                multiplier *= 2;
            }

            // Distribute Points
            const distribution = calculatePointDistribution(finalValue, user.id, target.user_id, multiplier);

            // 1. Mark Message Solved with Point Data
            await supabase.from('messages').update({
                is_solved: true,
                solved_by: user.id,
                winner_points: distribution.winnerPoints,
                author_points: distribution.type === 'STEAL' ? distribution.authorPoints : 0
            }).eq('id', target.id);

            // 2. Award Points
            await supabase.rpc('distribute_game_points', {
                game_id_param: game.id,
                winner_id: user.id,
                winner_amount: distribution.winnerPoints,
                author_id: distribution.type === 'STEAL' ? target.user_id : null,
                author_amount: distribution.type === 'STEAL' ? distribution.authorPoints : 0
            });

            // 3. Update Player Stats & Team Flow
            await supabase.from('game_players').update({
                consecutive_correct_guesses: consecutive
            }).eq('game_id', game.id).eq('user_id', user.id);

            await supabase.from('games').update({
                team_consecutive_correct: game.team_consecutive_correct + 1,
                fever_mode_remaining: Math.max(0, game.fever_mode_remaining - 1)
            }).eq('id', game.id);

            // Check fever mode trigger
            if (game.team_consecutive_correct + 1 >= 5 && game.fever_mode_remaining === 0) {
                await supabase.from('games').update({ fever_mode_remaining: 3 }).eq('id', game.id);
                toast.success("🔥 FEVER MODE ACTIVATED! Double points for next 3 words! 🔥");
            }

            // Set Just Solved for Animation (Local)
            setJustSolvedMessageId({ id: target.id, points: distribution.winnerPoints });
            setTimeout(() => setJustSolvedMessageId(null), 3000);

            toast.success(`Solved! +${distribution.winnerPoints} pts ${distribution.type === 'STEAL' ? '(Steal!)' : ''}`);

            const remainingUnsolved = messages.filter(m => !m.is_solved && m.id !== target.id && (m.strikes || 0) < 3);

            if (remainingUnsolved.length === 0) {
                await supabase.from('games').update({ status: 'completed' }).eq('id', game.id);
                setGame(prev => prev ? ({ ...prev, status: 'completed' }) : null);
            } else {
                await supabase.from('games').update({ solving_started_at: new Date().toISOString() }).eq('id', game.id);
            }
            setInput('');

        } else {
            // Wrong Guess logic
            const currentStrikes = target.strikes || 0;
            const newStrikes = currentStrikes + 1;

            // Optimistic Update
            setMessages(prev => prev.map(m => m.id === target.id ? { ...m, strikes: newStrikes, is_solved: newStrikes >= 3 ? true : m.is_solved } : m));

            setShakeMessageId(target.id);
            setTimeout(() => setShakeMessageId(null), 500);

            if (newStrikes >= 3) {
                toast.error(`💥 WORD LOST! The word was "${target.content}"`);
                await supabase.from('messages').update({ strikes: 3, is_solved: true }).eq('id', target.id);
            } else {
                toast.error(`Incorrect! Strike ${newStrikes}/3`);
                await supabase.from('messages').update({ strikes: newStrikes }).eq('id', target.id);
            }

            // Reset Multipliers
            await supabase.from('game_players').update({ consecutive_correct_guesses: 0 }).eq('game_id', game.id).eq('user_id', user.id);
            await supabase.from('games').update({
                team_consecutive_correct: 0,
                fever_mode_remaining: 0
            }).eq('id', game.id);

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

        if (game.current_turn_user_id && game.current_turn_user_id !== user.id) {
            toast.warning("It's not your turn!");
            return;
        }

        const wordCount = input.trim().split(/\s+/).length;
        if (wordCount < GAME_CONFIG.MESSAGE_WORD_LIMIT_MIN || wordCount > GAME_CONFIG.MESSAGE_WORD_LIMIT_MAX) {
            alert(`Message must be between ${GAME_CONFIG.MESSAGE_WORD_LIMIT_MIN} and ${GAME_CONFIG.MESSAGE_WORD_LIMIT_MAX} words.`);
            return;
        }

        setSending(true);

        try {
            // Calculate Potential Value
            const potentialValue = calculateMessageValue(input.trim());

            const { error } = await supabase
                .from('messages')
                .insert({
                    game_id: game.id,
                    user_id: user.id,
                    content: input.trim(),
                    cipher_length: input.trim().length,
                    is_solved: false,
                    strikes: 0,
                    hint_level: 0,
                    winner_points: 0,
                    author_points: 0
                });

            if (error) {
                console.error('Error sending message:', error);
                toast.error("Failed to send message");
                return;
            }

            // Update Team Pot
            await supabase.rpc('increment_team_pot', { game_id_param: game.id, amount: potentialValue });

            setInput('');

            if (players.length > 0) {
                const currentIndex = players.findIndex(p => p.user_id === user.id);
                if (currentIndex !== -1) {
                    const nextIndex = (currentIndex + 1) % players.length;
                    const nextPlayerId = players[nextIndex].user_id;
                    setGame(prev => prev ? ({ ...prev, current_turn_user_id: nextPlayerId }) : null);
                }
            }
        } finally {
            setSending(false);
        }
    };

    const proposeSolvingMode = async () => {
        if (!game || !user) return;
        const { error } = await supabase
            .from('games')
            .update({
                solving_proposal_created_at: new Date().toISOString(),
                solve_proposal_confirmations: [user.id]
            })
            .eq('id', game.id);
        if (error) console.error("Error proposing:", error);
    };

    const denySolvingMode = async () => {
        if (!game) return;
        const { error } = await supabase
            .from('games')
            .update({
                solving_proposal_created_at: null,
                solve_proposal_confirmations: []
            })
            .eq('id', game.id);
        if (error) console.error("Error denying:", error);
    };

    const confirmSolvingMode = async () => {
        if (!game || !user) return;

        // Prevent double confirmation locally
        if (game.solve_proposal_confirmations?.includes(user.id)) return;

        const newConfirmations = [...(game.solve_proposal_confirmations || []), user.id];

        // Optimistic check: if everyone confirmed, switch immediately
        const allConfirmed = players.every(p => newConfirmations.includes(p.user_id));

        if (allConfirmed) {
            const { error } = await supabase
                .from('games')
                .update({
                    status: 'solving',
                    solving_proposal_created_at: null,
                    solve_proposal_confirmations: [],
                    solving_started_at: new Date().toISOString()
                })
                .eq('id', game.id);
            if (error) console.error("Error completing confirmation:", error);
        } else {
            const { error } = await supabase
                .from('games')
                .update({
                    solve_proposal_confirmations: newConfirmations
                })
                .eq('id', game.id);
            if (error) console.error("Error confirming:", error);
        }
    };

    const handleGetHint = async () => {
        if (!game || game.status !== 'solving') return;

        const target = getTargetMessage();
        if (!target) {
            toast.info("No active message to hint!");
            return;
        }

        const nextLevel = (target.hint_level || 0) + 1;
        if (nextLevel > 3) {
            toast.info("Max hints used!");
            return;
        }

        const toastId = toast.loading("Revealing hint...");

        try {
            const newCipherText = generateCipherString(target.content, nextLevel);
            await supabase.from('messages').update({
                hint_level: nextLevel,
                cipher_text: newCipherText
            }).eq('id', target.id);

            toast.success(`Hint Level ${nextLevel} purchased!`, { id: toastId });

        } catch (error) {
            console.error("Hint error:", error);
            toast.error("Failed to buy hint", { id: toastId });
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
        confirmSolvingMode,
        handleGetHint,
        getTargetMessage,
        shakeMessageId,
        justSolvedData
    };
}
