'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function TestPlayground() {
    const { user } = useAuth();
    const [gameId, setGameId] = useState('');
    const [loading, setLoading] = useState(false);

    const createTestGame = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Create Game
            const { data: game, error: gameError } = await supabase
                .from('games')
                .insert({
                    status: 'active', // Start as active for testing
                    mode: 'free',
                    current_turn_user_id: user.id,
                })
                .select()
                .single();

            if (gameError) throw gameError;

            // Add Player
            await supabase.from('game_players').insert({
                game_id: game.id,
                user_id: user.id,
                score: 0
            });

            setGameId(game.id);
            toast.success(`Test Game Created: ${game.id}`);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const addMockMessages = async (count: number) => {
        if (!gameId || !user) {
            toast.error("Create a game first");
            return;
        }
        setLoading(true);
        try {
            const messages = Array.from({ length: count }).map((_, i) => ({
                game_id: gameId,
                user_id: user.id,
                content: `Mock Message ${i + 1} - ${Math.random().toString(36).substring(7)}`,
                cipher_length: 10,
                is_solved: false
            }));

            const { error } = await supabase.from('messages').insert(messages);
            if (error) throw error;
            toast.success(`Added ${count} messages`);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const forceSolveMode = async () => {
        if (!gameId) return;
        const { error } = await supabase
            .from('games')
            .update({ status: 'solving' })
            .eq('id', gameId);

        if (error) toast.error(error.message);
        else toast.success("Switched to Solving Mode");
    };

    const resetGame = async () => {
        if (!gameId) return;
        await supabase.from('messages').delete().eq('game_id', gameId);
        await supabase.from('games').update({ status: 'active' }).eq('id', gameId);
        toast.success("Game Reset");
    };

    return (
        <div className="p-8 max-w-2xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold text-purple-400">Test Playground 🧪</h1>

            <div className="bg-gray-900 border border-gray-800 rounded-lg">
                <div className="p-6 pb-0">
                    <h3 className="text-lg font-semibold leading-none tracking-tight">Game Management</h3>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex gap-4">
                        <Button onClick={createTestGame} disabled={loading}>
                            {loading ? 'Working...' : 'Create Test Game'}
                        </Button>
                        {gameId && (
                            <div className="p-2 bg-gray-800 rounded text-xs font-mono">
                                ID: {gameId}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {gameId && (
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="bg-gray-900 border border-gray-800 rounded-lg">
                        <div className="p-6 pb-0">
                            <h3 className="text-lg font-semibold leading-none tracking-tight">Data Injection</h3>
                        </div>
                        <div className="p-6 space-y-4 flex flex-col">
                            <Button onClick={() => addMockMessages(5)} variant="secondary">
                                Add 5 Mock Messages
                            </Button>
                            <Button onClick={() => addMockMessages(20)} variant="secondary">
                                Add 20 Mock Messages
                            </Button>
                        </div>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-lg">
                        <div className="p-6 pb-0">
                            <h3 className="text-lg font-semibold leading-none tracking-tight">State Control</h3>
                        </div>
                        <div className="p-6 space-y-4 flex flex-col">
                            <Button onClick={forceSolveMode} className="bg-purple-600 hover:bg-purple-700">
                                Force Solve Mode
                            </Button>
                            <Button onClick={resetGame} variant="destructive">
                                Reset Game Messages
                            </Button>
                            <a
                                href={`/game/${gameId}`}
                                target="_blank"
                                className="inline-flex items-center justify-center h-10 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90"
                            >
                                Open Game Room ↗
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
