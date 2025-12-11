'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { useRouter } from 'next/navigation';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Game = {
    id: string;
    status: string;
    mode: string;
    created_at: string;
    team_pot: number;
    team_consecutive_correct: number;
    fever_mode_remaining: number;
    player_count?: number;
    current_turn_user_id?: string;
    players?: {
        has_left: boolean;
        is_archived: boolean;
        user: {
            username: string;
            avatar_url: string;
        };
    }[];
};

export default function Lobby() {
    const { user } = useAuth();
    const router = useRouter();

    const [activeGames, setActiveGames] = useState<Game[]>([]);
    const [completedGames, setCompletedGames] = useState<Game[]>([]);
    const [creating, setCreating] = useState(false);
    const [gameToLeave, setGameToLeave] = useState<string | null>(null);
    const [leaving, setLeaving] = useState(false);

    useEffect(() => {
        if (!user) return;

        const fetchActiveGames = async () => {
            const { data: gamesData, error } = await supabase
                .from('games')
                .select(`
                    *,
                    game_players!inner (user_id, is_archived, has_left),
                    players:game_players (
                        has_left,
                        user:profiles (username, avatar_url)
                    )
                `)
                .eq('game_players.user_id', user.id)
                .neq('status', 'completed')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching active games:', error);
                return;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const filtered = (gamesData as any[]).filter((g) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const playerInfo = g.game_players.find((p: any) => p.user_id === user.id);
                return playerInfo && !playerInfo.is_archived && !playerInfo.has_left;
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setActiveGames(filtered.map((g: any) => ({
                ...g,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                player_count: g.players.filter((p: any) => !p.has_left).length
            })));
        };

        const fetchCompletedGames = async () => {
            const { data: gamesData, error } = await supabase
                .from('games')
                .select(`
                    *,
                    game_players!inner (user_id, is_archived, has_left),
                    players:game_players (
                        has_left,
                        user:profiles (username, avatar_url)
                    )
                `)
                .eq('game_players.user_id', user.id)
                .eq('status', 'completed')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching completed games:', error);
                return;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const filtered = (gamesData as any[]).filter((g) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const playerInfo = g.game_players.find((p: any) => p.user_id === user.id);
                return playerInfo && !playerInfo.is_archived && !playerInfo.has_left;
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setCompletedGames(filtered.map((g: any) => ({
                ...g,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                player_count: g.players.filter((p: any) => !p.has_left).length
            })));
        };

        const fetchAll = () => {
            fetchActiveGames();
            fetchCompletedGames();
        };

        fetchAll();

        const channel = supabase
            .channel('lobby_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => fetchAll())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players' }, () => fetchAll())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const createGame = async () => {
        if (!user) return;
        setCreating(true);

        try {
            // 1. Create Game
            const { data: game, error: gameError } = await supabase
                .from('games')
                .insert({
                    status: 'texting',
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

            router.push(`/game/${game.id}?action=invite`);

        } catch (error: any) {
            console.error('Error creating game:', JSON.stringify(error, null, 2));
            console.error('Full error object:', error);
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

            // 1. Get username for notification
            const { data: profile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', user.id)
                .single();

            const username = profile?.username || 'A player';

            // 2. Send notification message to chat
            await supabase
                .from('messages')
                .insert({
                    game_id: gameId,
                    user_id: user.id,
                    content: `${username} has left the game.`,
                    cipher_length: 0,
                    is_solved: true
                });

            // 3. Send system notifications to other players
            const { data: otherPlayers } = await supabase
                .from('game_players')
                .select('user_id')
                .eq('game_id', gameId)
                .neq('user_id', user.id)
                .eq('has_left', false); // Only notify active players

            if (otherPlayers && otherPlayers.length > 0) {
                const notifications = otherPlayers.map(p => ({
                    user_id: p.user_id,
                    type: 'player_left',
                    content: `${username} left Game #${gameId.slice(0, 4)}`,
                    metadata: { game_id: gameId }
                }));

                await supabase.from('notifications').insert(notifications);
            }

            // 4. Soft leave game (update has_left = true)
            const { error } = await supabase
                .from('game_players')
                .update({ has_left: true })
                .eq('game_id', gameId)
                .eq('user_id', user.id);

            if (error) throw error;

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

    const getInitials = (name: string) => {
        return name?.slice(0, 2).toUpperCase() || '??';
    };

    const GameCard = ({ game }: { game: Game }) => (
        <ContextMenu key={game.id}>
            <ContextMenuTrigger>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-purple-200 dark:border-purple-500/50 hover:border-purple-400 transition-colors cursor-pointer relative shadow-sm dark:shadow-none" onClick={() => router.push(`/game/${game.id}`)}>
                    {game.current_turn_user_id === user?.id && game.status !== 'completed' && (
                        <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-pulse z-10">
                            Your Turn
                        </span>
                    )}
                    <div className="flex justify-between items-start mb-4">
                        <span className={`text-xs px-2 py-1 rounded uppercase ${game.status === 'solving' ? 'bg-purple-900 text-purple-200' :
                            game.status === 'completed' ? 'bg-green-900 text-green-200' :
                                'bg-blue-900 text-blue-200'
                            }`}>
                            {game.status}
                        </span>
                        <span className="text-sm text-gray-400">{new Date(game.created_at).toLocaleTimeString()}</span>
                    </div>
                    <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Game #{game.id.slice(0, 4)}</h3>

                    {/* Player Avatars Stack */}
                    <div className="flex items-center pl-2">
                        {game.players?.map((player, index) => (
                            <div
                                key={index}
                                className={`relative -ml-2 transition-opacity ${player.has_left ? 'opacity-40 grayscale' : 'opacity-100'}`}
                                title={player.user?.username + (player.has_left ? ' (Left)' : '')}
                            >
                                <Avatar className="w-8 h-8 border-2 border-gray-800 ring-2 ring-purple-500/20">
                                    <AvatarImage src={player.user?.avatar_url} />
                                    <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200 text-[10px]">
                                        {getInitials(player.user?.username)}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                        ))}
                        {(!game.players || game.players.length === 0) && (
                            <span className="text-gray-500 text-sm italic ml-2">No players</span>
                        )}
                    </div>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                <ContextMenuItem onClick={() => handleArchive(game.id)} className="focus:bg-gray-800 cursor-pointer">
                    Archive Game
                </ContextMenuItem>
                <ContextMenuItem
                    onClick={() => setGameToLeave(game.id)}
                    className="text-red-500 focus:bg-gray-800 focus:text-red-400 cursor-pointer"
                >
                    Leave Game
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-12">
            {/* Active Games Section */}
            <section>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-purple-400">Your Games</h2>
                    <button
                        onClick={createGame}
                        disabled={creating}
                        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                        {creating ? 'Creating...' : 'Create New Game'}
                    </button>
                </div>

                {activeGames.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {activeGames.map((game) => (
                            <GameCard key={game.id} game={game} />
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
                            <GameCard key={game.id} game={game} />
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
        </div>
    );
}
