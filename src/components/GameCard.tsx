"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { formatDistanceToNow } from "date-fns";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip";

type Game = {
    id: string;
    handle: number;
    status: string;
    mode: string;
    created_at: string;
    last_activity_at?: string;
    max_messages: number;
    message_count?: number; // Fetched from relationship
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

interface GameCardProps {
    game: Game;
    onArchive: (gameId: string) => void;
    onLeave: (gameId: string) => void;
    onDelete?: (gameId: string) => void;
    onReset?: (gameId: string) => void;
    isAdmin?: boolean;
}

export default function GameCard({
    game,
    onArchive,
    onLeave,
    onDelete,
    onReset,
    isAdmin
}: GameCardProps) {
    const { user } = useAuth();
    const router = useRouter();

    const getInitials = (name: string) => {
        return name?.slice(0, 2).toUpperCase() || '??';
    };

    const activePlayers = game.players?.filter(p => !p.has_left) || [];
    const displayPlayers = activePlayers.slice(0, 4);
    const remainingPlayers = activePlayers.length - 4;

    const handleDisplay = game.handle
        ? `${game.mode.charAt(0).toUpperCase() + game.mode.slice(1)} Game #${game.handle}`
        : `Game #${game.id.slice(0, 4)}`;

    const lastActivity = game.last_activity_at
        ? formatDistanceToNow(new Date(game.last_activity_at), { addSuffix: true })
        : formatDistanceToNow(new Date(game.created_at), { addSuffix: true });

    const messageProgress = game.message_count !== undefined
        ? `${game.message_count}/${game.max_messages}`
        : `${game.max_messages} max`;

    const isMyTurn = game.current_turn_user_id === user?.id && game.status !== 'completed';

    return (
        <ContextMenu>
            <ContextMenuTrigger>
                <div
                    className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-purple-200 dark:border-purple-500/50 hover:border-purple-400 transition-colors cursor-pointer relative shadow-sm dark:shadow-none group flex flex-col h-full"
                    onClick={() => router.push(`/game/${game.id}`)}
                >
                    {/* Status Badge */}
                    <div className="flex justify-between items-start mb-3">
                        <span className={`text-xs px-2 py-1 rounded uppercase font-bold tracking-wide ${game.status === 'solving' ? 'bg-purple-900/80 text-purple-200 border border-purple-700' :
                                game.status === 'completed' ? 'bg-green-900/80 text-green-200 border border-green-700' :
                                    'bg-blue-900/80 text-blue-200 border border-blue-700'
                            }`}>
                            {game.status}
                        </span>
                        {isMyTurn && (
                            <span className="bg-green-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shadow-lg animate-pulse ml-2">
                                Your Turn
                            </span>
                        )}
                    </div>

                    {/* Handle & Activity */}
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight mb-1 truncate" title={handleDisplay}>
                            {handleDisplay}
                        </h3>
                        <div className="flex items-center text-xs text-gray-400 gap-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="hover:text-gray-300 transition-colors">Last moved {lastActivity}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{new Date(game.last_activity_at || game.created_at).toLocaleString()}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <span>•</span>
                            <span className="font-mono">{messageProgress} msgs</span>
                        </div>
                    </div>

                    {/* Footer: Players & CTA */}
                    <div className="mt-auto flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/50">
                        {/* Player Avatars */}
                        <div className="flex items-center pl-2">
                            {displayPlayers.map((player, index) => (
                                <div
                                    key={index}
                                    className="relative -ml-2 hover:z-10 transition-transform hover:scale-110"
                                    title={player.user?.username}
                                >
                                    <Avatar className="w-8 h-8 border-2 border-white dark:border-gray-800 ring-1 ring-black/5 dark:ring-white/10">
                                        <AvatarImage src={player.user?.avatar_url} />
                                        <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200 text-[10px] font-bold">
                                            {getInitials(player.user?.username)}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                            ))}
                            {remainingPlayers > 0 && (
                                <div className="relative -ml-2 z-0">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-gray-300">
                                        +{remainingPlayers}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* CTA Button */}
                        <div>
                            {game.status === 'completed' ? (
                                <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/game/${game.id}`);
                                }}>
                                    View
                                </Button>
                            ) : game.status === 'solving' ? (
                                <Button size="sm" className="h-7 text-xs bg-purple-600 hover:bg-purple-700" onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/game/${game.id}`);
                                }}>
                                    Solve
                                </Button>
                            ) : (
                                <Button size="sm" variant="outline" className="h-7 text-xs border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-900/20" onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/game/${game.id}`);
                                }}>
                                    Play
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </ContextMenuTrigger>

            <ContextMenuContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <ContextMenuItem onClick={() => onArchive(game.id)}>Archive Game</ContextMenuItem>
                <ContextMenuItem onClick={() => onLeave(game.id)} className="text-red-500 focus:text-red-500">Leave Game</ContextMenuItem>
                {isAdmin && (
                    <>
                        <div className="h-px bg-gray-200 dark:bg-gray-800 my-1" />
                        <ContextMenuItem onClick={() => onDelete?.(game.id)} className="text-red-600 font-bold">Admin: Delete</ContextMenuItem>
                        <ContextMenuItem onClick={() => onReset?.(game.id)} className="text-orange-600 font-bold">Admin: Reset</ContextMenuItem>
                    </>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
}
