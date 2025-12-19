'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/hooks/useAdmin';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { GAME_MODES } from '@/lib/gameConfig';
import { Label } from '@/components/ui/label';
import GameCard from './GameCard';
import { usePostHog } from 'posthog-js/react';

// Match the type in GameCard.tsx
type Game = {
    id: string;
    handle: number;
    status: string;
    mode: string;
    created_at: string;
    last_activity_at?: string;
    max_messages: number;
    message_count: number;
    current_turn_user_id?: string;
    players?: {
        has_left: boolean;
        is_archived: boolean;
        user: {
            username: string;
            avatar_url: string;
        };
    }[];
    // Extra fields for logic
    team_pot: number;
    team_consecutive_correct: number;
    fever_mode_remaining: number;
};

export default function Lobby() {
    const { user } = useAuth();
    const { isAdmin } = useAdmin();
    const router = useRouter();
    const posthog = usePostHog();

    const [activeGames, setActiveGames] = useState<Game[]>([]);
    const [completedGames, setCompletedGames] = useState<Game[]>([]);
    const [creating, setCreating] = useState(false);
    const [gameToLeave, setGameToLeave] = useState<string | null>(null);
    const [leaving, setLeaving] = useState(false);

    // Create Game State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedModeId, setSelectedModeId] = useState<string>(GAME_MODES[0].id);

    useEffect(() => {
        if (!user) return;

        const fetchGames = async () => {
            console.log('Fetching games for user:', user.id);
            // Fetch both active and completed in one go or separate if needed complexity
            // We'll fetch all relevant games for the user
            const { data: gamesData, error } = await supabase
                .from('games')
                .select(`
                    *,
                    messages(count),
                    game_players!inner (user_id, is_archived, has_left),
                    players:game_players (
                        has_left,
                        user:profiles (username, avatar_url)
                    )
                `)
                .eq('game_players.user_id', user.id)
                .order('last_activity_at', { ascending: false, nullsFirst: false }); // Sort by activity

            if (error) {
                console.error('Error fetching games:', error);
                return;
            }

            console.log('Games fetched:', gamesData?.length);

            // Transform data to match Game type
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const formattedGames: Game[] = (gamesData as any[]).map((g) => {
                // Determine message count
                // supabase returns [{ count: N }] for messages(count) usually, or just count if using strict count?
                // Actually with select('*, messages(count)') it returns messages: [{ count: 123 }] usually.
                // Let's inspect safely.
                const msgCount = g.messages?.[0]?.count ?? 0;

                return {
                    ...g,
                    message_count: msgCount,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    player_count: g.players.filter((p: any) => !p.has_left).length
                };
            });

            // Filter and split
            const active: Game[] = [];
            const completed: Game[] = [];

            formattedGames.forEach(g => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const playerInfo = (g as any).game_players.find((p: any) => p.user_id === user.id);

                // If archived or left, don't show (unless we want to show archived separately?)
                // Current logic implies checking is_archived/has_left
                if (playerInfo?.is_archived || playerInfo?.has_left) return;

                if (g.status === 'completed') {
                    completed.push(g);
                } else {
                    active.push(g);
                }
            });

            setActiveGames(active);
            setCompletedGames(completed);
        };

        const fetchAll = () => {
            fetchGames();
        };

        fetchAll();

        // Refetch when window gains focus (fixes back navigation stale state)
        const handleFocus = () => {
            console.log("Window focused, refreshing lobby...");
            fetchAll();
        };
        window.addEventListener('focus', handleFocus);

        const channel = supabase
            .channel('lobby_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => fetchAll())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players' }, () => fetchAll())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('focus', handleFocus);
        };
    }, [user]);

    const createGame = async () => {
        if (!user) return;
        setCreating(true);

        try {
            const selectedMode = GAME_MODES.find(m => m.id === selectedModeId);
            const maxMessages = selectedMode ? selectedMode.limit : 25;

            // 1. Create Game
            const { data: game, error: gameError } = await supabase
                .from('games')
                .insert({
                    status: 'texting',
                    mode: 'free',
                    current_turn_user_id: user.id,
                    max_messages: maxMessages
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

            posthog.capture('game_created', {
                game_id: game.id,
                status: 'texting', // Keeping status context might be useful, or just rely on event name
                messages_count: 0
            });

            setIsCreateOpen(false);
            router.push(`/game/${game.id}?action=invite`);

        } catch (error: any) {
            console.error('Error creating game:', JSON.stringify(error, null, 2));
            if (error.message) alert(`Failed to create game: ${error.message}`);
            else alert('Failed to create game (Unknown error)');
        } finally {
            setCreating(false);
        }
    };

    const confirmLeave = async () => {
        if (!gameToLeave || !user) return;
        setLeaving(true);

        try {
            const gameId = gameToLeave;

            // Call API action to handle leave logic (system message, turn rotation, etc.)
            const response = await fetch(`/api/game/${gameId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'leave_game' })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to leave game');
            }

            // Client-side state update handled below
            // No need for manual inserts/updates here

            // Optimistic update
            setActiveGames(prev => prev.filter(g => g.id !== gameId));
            setCompletedGames(prev => prev.filter(g => g.id !== gameId));
            toast.success("Left game successfully");
            setGameToLeave(null);

        } catch (error) {
            console.error('Error leaving game:', error);
            toast.error("Failed to leave game");
        } finally {
            setLeaving(false);
        }
    };

    const handleArchive = async (gameId: string) => {
        const { error } = await supabase
            .from('game_players')
            .update({ is_archived: true })
            .eq('game_id', gameId)
            .eq('user_id', user?.id);

        if (error) {
            console.error('Error archiving game:', error);
            alert('Failed to archive game');
        } else {
            setActiveGames(prev => prev.filter(g => g.id !== gameId));
            setCompletedGames(prev => prev.filter(g => g.id !== gameId));
        }
    };

    const handleDeleteGame = async (gameId: string) => {
        if (!confirm('Are you sure you want to delete this game? This cannot be undone.')) return;

        const { error } = await supabase
            .from('games')
            .delete()
            .eq('id', gameId);

        if (error) {
            console.error('Error deleting game:', error);
            toast.error('Failed to delete game');
        } else {
            toast.success('Game deleted');
            setActiveGames(prev => prev.filter(g => g.id !== gameId));
            setCompletedGames(prev => prev.filter(g => g.id !== gameId));
        }
    };

    const handleResetGame = async (gameId: string) => {
        if (!confirm('Are you sure you want to RESET this game? This will clear all scores and return to texting mode.')) return;

        try {
            await fetch(`/api/game/${gameId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset_game' })
            });
            toast.success('Game reset successfully');
        } catch (error) {
            console.error('Error resetting game:', error);
            toast.error('Failed to reset game');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-12">
            {/* Active Games Section */}
            <section>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-purple-400">Your Games</h2>
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        disabled={creating}
                        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                        Create New Game
                    </button>
                </div>

                {activeGames.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {activeGames.map((game) => (
                            <GameCard
                                key={game.id}
                                game={game}
                                onArchive={handleArchive}
                                onLeave={() => setGameToLeave(game.id)}
                                onDelete={handleDeleteGame}
                                onReset={handleResetGame}
                                isAdmin={isAdmin}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-400 text-center py-10 bg-gray-800/30 rounded-lg border border-gray-800 border-dashed">
                        You are not in any active games. Create one to get started!
                    </p>
                )}
            </section>

            {/* Completed Games Section */}
            {completedGames.length > 0 && (
                <section>
                    <h2 className="text-2xl font-bold text-green-400 mb-6">Past Games</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {completedGames.map((game) => (
                            <GameCard
                                key={game.id}
                                game={game}
                                onArchive={handleArchive}
                                onLeave={() => setGameToLeave(game.id)}
                                onDelete={handleDeleteGame}
                                onReset={handleResetGame}
                                isAdmin={isAdmin}
                            />
                        ))}
                    </div>
                </section>
            )}

            <Dialog open={!!gameToLeave} onOpenChange={(open) => !open && setGameToLeave(null)}>
                <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                    <DialogHeader>
                        <DialogTitle>Leave Game</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Are you sure you want to leave this game? You won&apos;t be able to rejoin unless invited again.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setGameToLeave(null)} disabled={leaving}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmLeave} disabled={leaving}>
                            {leaving ? 'Leaving...' : 'Leave Game'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Game Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create New Game</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Configure game settings before starting.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <Label className="text-base font-semibold mb-3 block">Game Length (Total Messages)</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {GAME_MODES.map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => setSelectedModeId(mode.id)}
                                    className={`
                                        p-3 rounded-lg border text-left transition-all
                                        ${selectedModeId === mode.id
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-500'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'}
                                    `}
                                >
                                    <div className={`font-bold ${selectedModeId === mode.id ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-white'}`}>
                                        {mode.name}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Max {mode.limit} messages
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="mt-4 text-xs text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-3 rounded">
                            * Once the limit is reached, the game will automatically switch to Solving Mode.
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsCreateOpen(false)} disabled={creating}>Cancel</Button>
                        <Button onClick={createGame} disabled={creating} className="bg-purple-600 hover:bg-purple-700 text-white">
                            {creating ? 'Creating...' : 'Start Game'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
