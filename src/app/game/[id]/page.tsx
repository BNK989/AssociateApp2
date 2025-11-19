'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { CipherText } from '@/components/CipherText';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft } from 'lucide-react';
import { InvitePlayer } from '@/components/InvitePlayer';
import { toast } from "sonner";

type Message = {
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

type GameState = {
    id: string;
    status: 'lobby' | 'active' | 'solving' | 'completed';
    mode: 'free' | '100_text';
    current_turn_user_id: string;
    solving_proposal_created_at?: string | null;
    solving_started_at?: string | null;
};

export default function GameRoom() {
    const { id } = useParams();
    const { user } = useAuth();
    const router = useRouter();
    const [game, setGame] = useState<GameState | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [players, setPlayers] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [proposalTimeLeft, setProposalTimeLeft] = useState<number | null>(null);
    const [solvingTimeLeft, setSolvingTimeLeft] = useState<number | null>(null);
    const [sending, setSending] = useState(false);

    const fetchGameData = async () => {
        if (!id) return;

        // Fetch Game
        const { data: gameData, error: gameError } = await supabase
            .from('games')
            .select('*')
            .eq('id', id)
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
            .eq('game_id', id)
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
            .eq('game_id', id)
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
            .channel(`game:${id}`)
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
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` }, (payload) => {
                setGame(payload.new as GameState);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_players', filter: `game_id=eq.${id}` }, async (payload) => {
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
                        .eq('game_id', id)
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
        if (!user || !id) return;
        fetchGameData();
        const cleanup = subscribeToGame();
        return () => {
            cleanup();
        };
    }, [user, id]);

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

    const getInitials = (name: string) => {
        return name
            ?.split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || '??';
    };

    const getAvatarColor = (name: string) => {
        const colors = [
            'bg-red-500', 'bg-orange-500', 'bg-amber-500',
            'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
            'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500',
            'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500',
            'bg-pink-500', 'bg-rose-500'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
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

    if (loading) return <div className="flex items-center justify-center h-screen">Loading Game...</div>;
    if (!game) return <div className="flex items-center justify-center h-screen">Game not found</div>;



    const targetMessage = getTargetMessage();

    // Determine who has the "turn"
    let activePlayerId = game.current_turn_user_id;
    if (game.status === 'solving' && targetMessage) {
        activePlayerId = targetMessage.user_id;
    }

    const isMyTurn = activePlayerId === user?.id;
    const currentTurnPlayer = players.find(p => p.user_id === activePlayerId);
    const isFreeForAll = solvingTimeLeft === 0;

    // Sort players for avatar stack: Active player last (on top)
    const sortedPlayers = [...players].sort((a, b) => {
        if (a.user_id === activePlayerId) return 1;
        if (b.user_id === activePlayerId) return -1;
        return 0;
    });

    const displayMessages = game.status === 'solving' ? [...messages].reverse() : messages;

    // Determine Placeholder Text
    let placeholderText = "Type a message...";
    if (game.status === 'solving') {
        if (isFreeForAll) {
            placeholderText = "Free for all! Guess the word!";
        } else if (isMyTurn) {
            placeholderText = `It's your word! You have ${solvingTimeLeft}s to reveal it!`;
        } else {
            placeholderText = `${currentTurnPlayer?.profiles?.username || 'Author'} is revealing their word... (${solvingTimeLeft}s)`;
        }
    } else {
        if (isMyTurn) {
            placeholderText = "It's your turn!";
        } else {
            placeholderText = `It is ${currentTurnPlayer?.profiles?.username || 'someone else'}'s turn`;
        }
    }

    // Determine if Input is Disabled
    const isInputDisabled = sending || (
        game.status === 'solving'
            ? (!isFreeForAll && !isMyTurn)
            : !isMyTurn
    );

    return (
        <div className="flex flex-col h-screen max-w-md mx-auto bg-gray-900">
            {/* Header */}
            <header className="p-4 border-b border-gray-800 flex justify-between items-center relative">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push('/')}
                        className="p-2 -ml-2 hover:bg-gray-800 rounded-full transition-colors"
                        aria-label="Back to Lobby"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    {/* Avatar Stack */}
                    <div className="flex items-center -space-x-2 mr-2">
                        {sortedPlayers.map((player) => (
                            <Avatar key={player.user_id} className={`w-8 h-8 border-2 border-gray-900 ${player.user_id === activePlayerId ? 'z-10 ring-2 ring-green-500' : ''}`}>
                                <AvatarImage src={player.profiles?.avatar_url} />
                                <AvatarFallback className={`${getAvatarColor(player.profiles?.username || '')} text-white text-xs`}>
                                    {getInitials(player.profiles?.username || '')}
                                </AvatarFallback>
                            </Avatar>
                        ))}
                    </div>

                    <div>
                        <h1 className="font-bold">Game #{game.id.slice(0, 4)}</h1>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="bg-blue-900 px-2 py-1 rounded uppercase">{game.status}</span>
                            <span className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {game.status !== 'solving' && (
                        <>
                            <InvitePlayer gameId={game.id} />
                            <button
                                onClick={proposeSolvingMode}
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs font-bold"
                            >
                                Solve
                            </button>
                        </>
                    )}
                    <button
                        onClick={fetchGameData}
                        className="p-2 text-sm bg-gray-800 hover:bg-gray-700 rounded border border-gray-700"
                    >
                        ↻
                    </button>
                </div>

                {/* Proposal Popup */}
                {game.solving_proposal_created_at && (
                    <div className="absolute top-full left-0 w-full bg-gray-800 border-b border-gray-700 p-2 flex justify-between items-center z-10 shadow-lg">
                        <span className="text-sm">Switching to Solving in {proposalTimeLeft}s...</span>
                        <button
                            onClick={denySolvingMode}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-bold"
                        >
                            Deny
                        </button>
                    </div>
                )}
            </header>

            {/* Chat Area */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${game.status === 'solving' ? 'flex flex-col-reverse' : ''}`}>
                {displayMessages.map((msg, index) => {
                    const originalIndex = messages.findIndex(m => m.id === msg.id);
                    const isActuallyLast = originalIndex === messages.length - 1;

                    const isVisible = msg.is_solved || (game.status !== 'solving' && isActuallyLast);
                    const isMe = msg.user_id === user?.id;
                    const username = msg.profiles?.username || 'User';

                    return (
                        <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            <Avatar className="w-8 h-8">
                                <AvatarImage src={msg.profiles?.avatar_url} />
                                <AvatarFallback className={`${getAvatarColor(username)} text-white text-xs`}>
                                    {getInitials(username)}
                                </AvatarFallback>
                            </Avatar>
                            <div className={`max-w-[70%] p-3 rounded-lg ${isMe ? 'bg-blue-600' : 'bg-gray-700'}`}>
                                <CipherText
                                    text={msg.content}
                                    visible={isVisible}
                                />
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-800 bg-gray-900">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    {game.status === 'solving' && (
                        <button
                            type="button"
                            onClick={handleGetHint}
                            className="p-3 rounded bg-yellow-600 hover:bg-yellow-700 text-white"
                            title="Get Hint"
                        >
                            💡
                        </button>
                    )}
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isInputDisabled}
                        placeholder={placeholderText}
                        className={`flex-1 p-3 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none ${game.status === 'solving' ? 'border-purple-500' : ''} ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    <button
                        type="submit"
                        disabled={isInputDisabled}
                        className={`p-3 rounded text-white font-bold ${game.status === 'solving' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {sending ? '...' : (game.status === 'solving' ? 'Guess' : 'Send')}
                    </button>
                </form>
            </div>


        </div>
    );
}
