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
    const [games, setGames] = useState<Game[]>([]);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchGames();

        const channel = supabase
            .channel('public:games')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
                fetchGames();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchGames = async () => {
        // Fetch games that are in 'lobby' status
        const { data, error } = await supabase
            .from('games')
            .select(`
        *,
        game_players (count)
      `)
            .eq('status', 'lobby')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching games:', error);
        } else {
            // Transform data to include player count
            const formattedGames = data.map((g: any) => ({
                ...g,
                player_count: g.game_players[0]?.count || 0
            }));
            setGames(formattedGames);
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
                    mode: 'free', // Default mode
                    current_turn_user_id: user.id, // Creator goes first? Or random. Let's say creator for now.
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

            // 3. Redirect to Game Room
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
            // Check if already joined? The RLS might handle duplicates or we check first.
            // For now, just try to insert.
            const { error } = await supabase
                .from('game_players')
                .insert({
                    game_id: gameId,
                    user_id: user.id,
                    score: 0
                });

            if (error) {
                // If duplicate key error, it means we are already in, just redirect
                if (error.code === '23505') { // Unique violation
                    router.push(`/game/${gameId}`);
                    return;
                }
                throw error;
            }

            router.push(`/game/${gameId}`);

        } catch (error) {
            console.error('Error joining game:', error);
            alert('Failed to join game');
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Active Games</h2>
                <button
                    onClick={createGame}
                    disabled={creating}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                    {creating ? 'Creating...' : 'Create New Game'}
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {games.length === 0 ? (
                    <p className="text-gray-400 col-span-full text-center py-10">No active games found. Create one!</p>
                ) : (
                    games.map((game) => (
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
    );
}
