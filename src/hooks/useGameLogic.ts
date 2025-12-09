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
    winner_points?: number;
    author_points?: number;
    game_id?: string;
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
    // Ref to access latest players in callbacks without re-subscribing
    const playersRef = useRef<Player[]>([]);

    useEffect(() => {
        playersRef.current = players;
    }, [players]);
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

        try {
            const response = await fetch(`/api/game/${gameId}/state`);
            if (!response.ok) {
                if (response.status === 401) {
                    console.error("Unauthorized fetch");
                    // Optionally redirect or handle session
                    return;
                }
                throw new Error(`Fetch failed: ${response.status}`);
            }

            const data = await response.json();

            setGame(data.game);
            setPlayers(data.players || []);
            setMessages(data.messages || []);
            setLoading(false);

            // Access Control
            if (user && data.players) {
                const isPlayer = data.players.some((p: any) => p.user_id === user.id);
                if (!isPlayer) {
                    toast.error("You are not part of this game!");
                    router.push('/');
                }
            }

        } catch (error) {
            console.error('Error fetching game data:', error);
            // toast.error("Failed to sync game data"); // Silent fail on polling is better
        }
    };

    const subscribeToGame = () => {
        const channel = supabase
            .channel(`game:${gameId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async (payload) => {
                if (payload.eventType === 'INSERT') {
                    // OPTIMIZATION: Try to find profile from local players cache first to avoid blocking DB call
                    const localPlayer = playersRef.current.find(p => p.user_id === payload.new.user_id);

                    let profile = localPlayer?.profiles;

                    // Fallback: only fetch if we don't have it locally (e.g. brand new player not yet synced)
                    if (!profile) {
                        const { data } = await supabase
                            .from('profiles')
                            .select('username, avatar_url')
                            .eq('id', payload.new.user_id)
                            .single();
                        if (data) profile = data;
                    }

                    const newMessage = { ...payload.new, profiles: profile } as unknown as Message;

                    setMessages(prev => {
                        // Check if we have an optimistic temporary message that matches this real one
                        const optimisticIndex = prev.findIndex(m =>
                            m.id.startsWith('temp-') &&
                            m.content === newMessage.content &&
                            m.user_id === newMessage.user_id
                        );

                        if (optimisticIndex !== -1) {
                            // Replace the optimistic message with the real one in place
                            const newMessages = [...prev];
                            newMessages[optimisticIndex] = newMessage;
                            return newMessages;
                        }

                        // Otherwise just append (it's a message from someone else)
                        return [...prev, newMessage];
                    });
                } else if (payload.eventType === 'UPDATE') {
                    const updatedMessage = payload.new as any;
                    setMessages(prev => prev.map(m => m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m));

                    // Trigger Animation for Realtime Updates
                    if (updatedMessage.is_solved && user) {
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

    // Track previous length to prevent auto-scrolling on unchanged polling
    const prevMessagesLength = useRef(0);
    // Track last action time to pause polling during mutations to prevent flickering
    const lastActionTime = useRef(0);

    useEffect(() => {
        if (!user || !gameId) return;
        fetchGameData();
        const cleanupSubscription = subscribeToGame();

        // Polling Strategy: Fetch full game data every 5 seconds to ensure consistency
        const pollInterval = setInterval(() => {
            const timeSinceLastAction = Date.now() - lastActionTime.current;
            // Only poll if tab is visible AND we haven't performed an action recently
            if (document.visibilityState === 'visible' && timeSinceLastAction > 4000) {
                fetchGameData();
            }
        }, 5000);

        return () => {
            cleanupSubscription();
            clearInterval(pollInterval);
        };
    }, [user, gameId]);



    useEffect(() => {
        if (messages.length > prevMessagesLength.current) {
            scrollToBottom();
            prevMessagesLength.current = messages.length;
        } else if (messages.length === 0 && prevMessagesLength.current > 0) {
            // Reset if messages cleared (unlikely but safe)
            prevMessagesLength.current = 0;
        }
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

        lastActionTime.current = Date.now();


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

            // OPTIMISTIC UPDATE LOCAL STATE
            // 1. Mark Message Solved
            setMessages(prev => prev.map(m => m.id === target.id ? {
                ...m,
                is_solved: true,
                solved_by: user.id,
                winner_points: distribution.winnerPoints,
                author_points: distribution.type === 'STEAL' ? distribution.authorPoints : 0
            } : m));

            // 2. Set Just Solved Animation
            setJustSolvedMessageId({ id: target.id, points: distribution.winnerPoints });
            setTimeout(() => setJustSolvedMessageId(null), 3000);
            toast.success(`Solved! +${distribution.winnerPoints} pts ${distribution.type === 'STEAL' ? '(Steal!)' : ''}`);

            setInput('');

            // SERVER ACTION call
            fetch(`/api/game/${game.id}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'solve_attempt',
                    payload: {
                        targetId: target.id,
                        isMatch: true,
                        winnerPoints: distribution.winnerPoints,
                        authorPoints: distribution.type === 'STEAL' ? distribution.authorPoints : 0,
                        type: distribution.type,
                        targetUserId: target.user_id,
                        consecutive: consecutive
                    }
                })
            }).then(() => fetchGameData()); // Sync after action

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
            } else {
                toast.error(`Incorrect! Strike ${newStrikes}/3`);
            }

            setInput('');

            // SERVER ACTION call
            fetch(`/api/game/${game.id}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'solve_attempt',
                    payload: {
                        targetId: target.id,
                        isMatch: false,
                        strikes: currentStrikes
                    }
                })
            }).then(() => fetchGameData());
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
            lastActionTime.current = Date.now(); // Pause polling while we send

            // Generate Cipher Locally
            const cipher = generateCipherString(input.trim(), 0);

            // OPTIMISTIC UPDATE: Show message immediately
            const tempId = `temp-${Date.now()}`;
            const optimisticMessage: Message = {
                id: tempId,
                // game_id is not in local Message type, so skip it
                user_id: user.id,
                content: input.trim(),
                cipher_length: input.trim().length,
                is_solved: false,
                strikes: 0,
                hint_level: 0,
                winner_points: 0,
                author_points: 0,
                created_at: new Date().toISOString(),
                cipher_text: cipher, // Use local cipher
                profiles: {
                    username: user.email?.split('@')[0] || 'You', // Fallback
                    avatar_url: '' // Fallback or fetch from user metadata if available
                }
            };

            // Try to find better profile info from existing players list
            const myPlayerProfile = players.find(p => p.user_id === user.id)?.profiles;
            if (myPlayerProfile) {
                optimisticMessage.profiles = myPlayerProfile;
            }

            setMessages(prev => [...prev, optimisticMessage]);
            setInput(''); // Clear input immediately for better UX
            scrollToBottom();

            // Helper function to send via API with retry
            const sendSafe = async (attempt = 0): Promise<boolean> => {
                const MAX_RETRIES = 3;
                try {
                    if (typeof navigator !== 'undefined' && !navigator.onLine) {
                        throw new Error("Browser is offline");
                    }

                    // Strict fetch with timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                    console.log(`Sending message via Server API (Attempt ${attempt + 1})...`);

                    try {
                        const response = await fetch('/api/messages/send', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                game_id: game.id,
                                content: input.trim(),
                                cipher_length: input.trim().length,
                                cipher_text: cipher, // Send generated cipher
                                is_solved: false,
                                strikes: 0,
                                hint_level: 0,
                                winner_points: 0,
                                author_points: 0,
                                potentialValue: potentialValue
                            }),
                            signal: controller.signal
                        });

                        clearTimeout(timeoutId);

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || `Server error: ${response.status}`);
                        }

                        console.log("Message sent successfully via API!");

                        // Force a refresh immediately so the sender sees the message 
                        // even if the Realtime socket is lagging/disconnected
                        fetchGameData();

                        return true;

                    } catch (fetchErr: any) {
                        clearTimeout(timeoutId);
                        if (fetchErr.name === 'AbortError') {
                            throw new Error('Request timed out');
                        }
                        throw fetchErr;
                    }

                } catch (err: any) {
                    console.error("Attempt failed:", err.message || err);
                    if (attempt < MAX_RETRIES) {
                        console.log(`Retry attempt ${attempt + 1}/${MAX_RETRIES}`);
                        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt))); // Exponential backoff
                        return await sendSafe(attempt + 1);
                    }
                    throw err;
                }
            };

            await sendSafe();

            setInput('');

            if (players.length > 0) {
                const currentIndex = players.findIndex(p => p.user_id === user.id);
                if (currentIndex !== -1) {
                    const nextIndex = (currentIndex + 1) % players.length;
                    const nextPlayerId = players[nextIndex].user_id;
                    setGame(prev => prev ? ({ ...prev, current_turn_user_id: nextPlayerId }) : null);
                }
            }
        } catch (err) {
            console.error("Message sending error:", err);
            toast.error("Failed to send message. Please check your connection and try again.");
        } finally {
            setSending(false);
        }
    };

    const proposeSolvingMode = async () => {
        if (!game || !user) return;
        lastActionTime.current = Date.now();
        try {
            await fetch(`/api/game/${game.id}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'propose_solve' })
            });
            fetchGameData();
        } catch (e) {
            console.error("Error proposing:", e);
        }
    };

    const denySolvingMode = async () => {
        if (!game) return;
        lastActionTime.current = Date.now();
        try {
            await fetch(`/api/game/${game.id}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deny_solve' })
            });
            fetchGameData();
        } catch (e) {
            console.error("Error denying:", e);
        }
    };

    const confirmSolvingMode = async () => {
        if (!game || !user) return;
        if (game.solve_proposal_confirmations?.includes(user.id)) return;
        lastActionTime.current = Date.now();

        try {
            await fetch(`/api/game/${game.id}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'confirm_solve' })
            });
            fetchGameData();
        } catch (e) {
            console.error("Error confirming:", e);
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

        lastActionTime.current = Date.now();
        const toastId = toast.loading("Revealing hint...");

        try {
            const newCipherText = generateCipherString(target.content, nextLevel);

            // OPTIMISTIC UPDATE
            setMessages(prev => prev.map(m => m.id === target.id ? {
                ...m,
                hint_level: nextLevel,
                cipher_text: newCipherText
            } : m));

            await fetch(`/api/game/${game.id}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'get_hint',
                    payload: {
                        targetId: target.id,
                        nextLevel: nextLevel,
                        newCipherText: newCipherText
                    }
                })
            });

            // Sync immediately after
            fetchGameData();

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
