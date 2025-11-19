'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { CipherText } from '@/components/CipherText';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
};

export default function GameRoom() {
    const { id } = useParams();
    const { user } = useAuth();
    const router = useRouter();
    const [game, setGame] = useState<GameState | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [proposalTimeLeft, setProposalTimeLeft] = useState<number | null>(null);

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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !user || !game) return;

        if (game.status === 'solving') {
            handleSolveAttempt();
            return;
        }

        // Validation (Word count)
        const wordCount = input.trim().split(/\s+/).length;
        if (wordCount < GAME_CONFIG.MESSAGE_WORD_LIMIT_MIN || wordCount > GAME_CONFIG.MESSAGE_WORD_LIMIT_MAX) {
            alert(`Message must be between ${GAME_CONFIG.MESSAGE_WORD_LIMIT_MIN} and ${GAME_CONFIG.MESSAGE_WORD_LIMIT_MAX} words.`);
            return;
        }

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
        } else {
            setInput('');
        }
    };

    const handleSolveAttempt = async () => {
        const reversed = [...messages].reverse();
        const target = reversed.find(m => !m.is_solved);

        if (!target) {
            alert("All messages solved!");
            return;
        }

        if (input.trim().toLowerCase() === target.content.toLowerCase()) {
            const { error } = await supabase
                .from('messages')
                .update({ is_solved: true })
                .eq('id', target.id);

            if (error) console.error("Error solving:", error);
            else setInput('');
        } else {
            alert("Incorrect guess!");
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
                solving_proposal_created_at: null
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

    if (loading) return <div className="flex items-center justify-center h-screen">Loading Game...</div>;
    if (!game) return <div className="flex items-center justify-center h-screen">Game not found</div>;

    const displayMessages = game.status === 'solving' ? [...messages].reverse() : messages;

    return (
        <div className="flex flex-col h-screen max-w-md mx-auto bg-gray-900">
            {/* Header */}
            <header className="p-4 border-b border-gray-800 flex justify-between items-center relative">
                <div>
                    <h1 className="font-bold">Game #{game.id.slice(0, 4)}</h1>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="bg-blue-900 px-2 py-1 rounded uppercase">{game.status}</span>
                        <span className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                    </div>
                </div>

                {game.status !== 'solving' && (
                    <button
                        onClick={proposeSolvingMode}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs font-bold"
                    >
                        Start Solving
                    </button>
                )}
                <button
                    onClick={fetchGameData}
                    className="ml-2 p-2 text-sm bg-gray-800 hover:bg-gray-700 rounded border border-gray-700"
                >
                    ↻
                </button>

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
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={game.status === 'solving' ? "Guess the word..." : "Type your association..."}
                        className={`flex-1 p-3 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none ${game.status === 'solving' ? 'border-purple-500' : ''}`}
                    />
                    <button
                        type="submit"
                        className={`p-3 rounded text-white font-bold ${game.status === 'solving' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {game.status === 'solving' ? 'Guess' : 'Send'}
                    </button>
                </form>
            </div>
        </div>
    );
}
