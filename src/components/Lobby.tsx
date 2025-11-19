'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { useRouter } from 'next/navigation';

type Game = {
    id: string;
    status: string;
    mode: string;
    created_at: string;
    player_count?: number;
};

export default function Lobby() {
    const { user } = useAuth();
    const router = useRouter();
    const [openGames, setOpenGames] = useState<Game[]>([]);
    const [myGames, setMyGames] = useState<Game[]>([]);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (user) {
            fetchGames();

            const channel = supabase
                .channel('lobby_updates')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => fetchGames())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players' }, () => fetchGames())
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [user]);

    const fetchGames = async () => {
        if (!user) return;

        // 1. Fetch My Games (Active/Lobby/Solving where I am a player)
        const { data: myGamesData, error: myGamesError } = await supabase
            .from('games')
            .select(`
                *,
                game_players!inner (user_id),
                players:game_players (count)
            `)
            .eq('game_players.user_id', user.id)
            .neq('status', 'completed')
            .order('created_at', { ascending: false });

        if (myGamesError) console.error('Error fetching my games:', myGamesError);
        else {
            setMyGames(myGamesData.map((g: any) => ({
                ...g,
                player_count: g.players[0]?.count || 0
            })));
        }

        // 2. Fetch Open Lobbies (Status = lobby)
        const { data: lobbyData, error: lobbyError } = await supabase
            .from('games')
            .select(`
                *,
                game_players (count)
            `)
            .eq('status', 'lobby')
            .order('created_at', { ascending: false });

        if (lobbyError) console.error('Error fetching lobbies:', lobbyError);
        else {
            setOpenGames(lobbyData.map((g: any) => ({
                ...g,
                player_count: g.game_players[0]?.count || 0
            })));
        }
    };

    const createGame = async () => {
        if (!user) return;
        setCreating(true);

        try {
            // 1. Create Game
            const { data: game, error: gameError } = await supabase
                .from('games')
                .insert({
                    status: 'lobby',
                    mode: 'free',
                    current_turn_user_id: user.id,
                })
                .select()
                .single();

            if (gameError) throw gameError;

            // 2. Add Creator as Player
            const { error: playerError } = await supabase
                .from('game_players')
                .insert({
                    game_id: game.id,
                    user_id: user.id,
                    score: 0
                });

            if (playerError) throw playerError;

            router.push(`/game/${game.id}`);

        } catch (error) {
            console.error('Error creating game:', error);
            alert('Failed to create game');
        } finally {
            setCreating(false);
        }
    };

    const joinGame = async (gameId: string) => {
        if (!user) return;

        try {
            const { error } = await supabase
                .from('game_players')
                .insert({
                    game_id: gameId,
                    user_id: user.id,
                    score: 0
                });

            if (error && error.code !== '23505') throw error; // Ignore unique violation (already joined)
            router.push(`/game/${gameId}`);

        } catch (error) {
            console.error('Error joining game:', error);
            alert('Failed to join game');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* My Games Section */}
            {myGames.length > 0 && (
                <div>
                    <h2 className="text-2xl font-bold mb-4 text-purple-400">My Active Games</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {myGames.map((game) => (
                            <div key={game.id} className="bg-gray-800 p-4 rounded-lg border border-purple-500/50 hover:border-purple-400 transition-colors cursor-pointer" onClick={() => router.push(`/game/${game.id}`)}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-xs px-2 py-1 rounded uppercase ${game.status === 'solving' ? 'bg-purple-900 text-purple-200' : 'bg-blue-900 text-blue-200'}`}>
                                        {game.status}
                                    </span>
                                    <span className="text-sm text-gray-400">{new Date(game.created_at).toLocaleTimeString()}</span>
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Game #{game.id.slice(0, 4)}</h3>
                                <p className="text-gray-400 text-sm">Players: {game.player_count}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Open Lobbies Section */}
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Open Lobbies</h2>
                    <button
                        onClick={createGame}
                        disabled={creating}
                        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                        {creating ? 'Creating...' : 'Create New Game'}
                    </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {openGames.length === 0 ? (
                        <p className="text-gray-400 col-span-full text-center py-10">No open lobbies found. Create one!</p>
                    ) : (
                        openGames.map((game) => (
                            <div key={game.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-purple-500 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="bg-gray-700 text-xs px-2 py-1 rounded uppercase">{game.mode}</span>
                                    <span className="text-sm text-gray-400">{new Date(game.created_at).toLocaleTimeString()}</span>
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Game #{game.id.slice(0, 4)}</h3>
                                <p className="text-gray-400 text-sm mb-4">Players: {game.player_count}/5</p>
                                <button
                                    onClick={() => joinGame(game.id)}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
                                >
                                    Join Game
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
