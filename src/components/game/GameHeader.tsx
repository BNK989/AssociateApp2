import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InvitePlayer } from '@/components/InvitePlayer';
import { GameState, Player, Message } from '@/hooks/useGameLogic';

type GameHeaderProps = {
    game: GameState;
    user: any;
    players: Player[];
    loading: boolean;
    proposalTimeLeft: number | null;
    solvingTimeLeft: number | null;
    targetMessage?: Message;
    messageCount: number;
    onBack: () => void;
    onRefresh: () => void;
    onProposeSolving: () => void;
    onDenySolving: () => void;
};

export function GameHeader({
    game,
    user,
    players,
    loading,
    proposalTimeLeft,
    solvingTimeLeft,
    targetMessage,
    messageCount,
    onBack,
    onRefresh,
    onProposeSolving,
    onDenySolving
}: GameHeaderProps) {

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

    // Determine active player ID for highlighting
    let activePlayerId = game.current_turn_user_id;
    if (game.status === 'solving' && targetMessage) {
        activePlayerId = targetMessage.user_id;
    }

    // Sort players for avatar stack: Active player last (on top)
    const sortedPlayers = [...players].sort((a, b) => {
        if (a.user_id === activePlayerId) return 1;
        if (b.user_id === activePlayerId) return -1;
        return 0;
    });

    return (
        <header className="fixed top-0 left-0 right-0 z-20 max-w-md mx-auto bg-white dark:bg-gray-900 p-2 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-900 dark:text-white"
                    aria-label="Back to Lobby"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>

                {/* Avatar Stack */}
                <div className="flex items-center -space-x-2 mr-2">
                    {sortedPlayers.map((player) => (
                        <Avatar key={player.user_id} className={`w-8 h-8 border-2 border-white dark:border-gray-900 ${player.user_id === activePlayerId ? 'z-10 ring-2 ring-green-500' : ''}`}>
                            <AvatarImage src={player.profiles?.avatar_url} />
                            <AvatarFallback className={`${getAvatarColor(player.profiles?.username || '')} text-white text-xs`}>
                                {getInitials(player.profiles?.username || '')}
                            </AvatarFallback>
                        </Avatar>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {game.status !== 'solving' && (
                    <>
                        {messageCount < 5 ? (
                            <InvitePlayer gameId={game.id} />
                        ) : (
                            <button
                                onClick={onProposeSolving}
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs font-bold"
                            >
                                Solve
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Proposal Popup */}
            {game.solving_proposal_created_at && (
                <div className="absolute top-full left-0 w-full bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2 flex justify-between items-center z-10 shadow-lg text-gray-900 dark:text-white">
                    <span className="text-sm">Switching to Solving in {proposalTimeLeft}s...</span>
                    <button
                        onClick={onDenySolving}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-bold"
                    >
                        Deny
                    </button>
                </div>
            )}
        </header>
    );
}
