import React from 'react';
import { ArrowLeft, Flame, Landmark, Star, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InvitePlayer } from '@/components/InvitePlayer';
import { GameState, Player, Message } from '@/hooks/useGameLogic';
import { Progress } from "@/components/ui/progress";

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
    onConfirmSolving: () => void;
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
    onConfirmSolving,
    onDenySolving
}: GameHeaderProps) {
    const router = useRouter();

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

    const isFeverMode = (game.fever_mode_remaining || 0) > 0;
    const teamFlowProgress = ((game.team_consecutive_correct || 0) % 5) * 20;
    const myScore = players.find(p => p.user_id === user?.id)?.score || 0;
    const maxScore = Math.max(...players.map(p => p.score || 0));
    const isLeader = myScore === maxScore && myScore > 0;
    const teamPot = game.team_pot || 0;

    const [displayScore, setDisplayScore] = React.useState(0);
    const [displayPot, setDisplayPot] = React.useState(0);

    // Initial sync
    React.useEffect(() => {
        setDisplayScore(myScore);
        setDisplayPot(teamPot);
    }, []);

    // Count up animation for Score
    React.useEffect(() => {
        if (displayScore === myScore) return;

        const diff = myScore - displayScore;
        if (diff === 0) return;

        const step = Math.ceil(Math.abs(diff) / 10); // 10 frames approx

        const timer = setInterval(() => {
            setDisplayScore(prev => {
                const newDiff = myScore - prev;
                if (Math.abs(newDiff) <= step) {
                    clearInterval(timer);
                    return myScore;
                }
                return prev + (newDiff > 0 ? step : -step);
            });
        }, 30);

        return () => clearInterval(timer);
    }, [myScore, displayScore]);

    // Count up animation for Pot
    React.useEffect(() => {
        if (displayPot === teamPot) return;

        const diff = teamPot - displayPot;
        if (diff === 0) return;

        const step = Math.ceil(Math.abs(diff) / 10); // 10 frames approx

        const timer = setInterval(() => {
            setDisplayPot(prev => {
                const newDiff = teamPot - prev;
                if (Math.abs(newDiff) <= step) {
                    clearInterval(timer);
                    return teamPot;
                }
                return prev + (newDiff > 0 ? step : -step);
            });
        }, 30);

        return () => clearInterval(timer);
    }, [teamPot, displayPot]);

    return (
        <header className={`fixed top-0 left-0 right-0 z-20 max-w-md mx-auto bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 transition-colors duration-500 ${isFeverMode ? 'dark:bg-orange-950/30' : ''}`}>
            {/* Main Header Row */}
            <div className="p-2 flex justify-between items-center">
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

                {/* Score & Bank (Updated) */}
                <div className="flex items-center gap-4 mx-2">
                    {/* Bank / Pot */}
                    <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-bold opacity-80 scale-90">
                        <Landmark className="w-3.5 h-3.5" />
                        <span className="text-sm">{displayPot}</span>
                    </div>

                    {/* Vertical Divider */}
                    <div className="w-[1px] h-4 bg-gray-300 dark:bg-gray-700 mx-1" />

                    {/* User Score (Main) */}
                    <div className={`flex items-center gap-1.5 font-bold transition-all duration-300 ${isLeader ? 'text-amber-500 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        <div className="relative">
                            <Star className={`w-4 h-4 ${isLeader ? 'fill-current' : ''}`} />
                            {isLeader && <Crown className="absolute -top-3 -right-2 w-3 h-3 text-amber-500 animate-bounce" />}
                        </div>
                        <span className={`text-lg transition-all duration-300 ${displayScore !== myScore ? 'scale-125 text-green-500' : ''}`}>
                            {displayScore}
                        </span>
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
                                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs font-bold text-white transition-colors"
                                >
                                    Solve
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Stats Bar (Moved Below) - Only show in solving mode */}
            {game.status === 'solving' && (
                <div className="flex justify-between items-center px-4 py-1.5 bg-gray-50 dark:bg-gray-950/50 text-xs border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 flex-1 mr-4">
                        <div className="relative w-full">
                            <Progress value={isFeverMode ? 100 : teamFlowProgress} className={`h-1.5 ${isFeverMode ? 'animate-pulse' : ''}`} />
                            {isFeverMode && (
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase font-black text-orange-500 tracking-widest animate-bounce">
                                    Fever Mode!
                                </span>
                            )}
                        </div>
                    </div>

                    <div className={`flex items-center gap-1 font-bold ${isFeverMode ? 'text-orange-500' : 'text-gray-400'}`}>
                        <Flame className={`w-3.5 h-3.5 ${isFeverMode ? 'fill-orange-500' : ''}`} />
                        <span>{game.team_consecutive_correct || 0}</span>
                    </div>
                </div>
            )}

            {/* Proposal Popup */}
            {game.solving_proposal_created_at && (
                <div className="absolute top-full left-0 w-full bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2 flex justify-between items-center z-10 shadow-lg text-gray-900 dark:text-white">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold">Switch to Solving?</span>
                        <span className="text-xs opacity-70">
                            {game.solve_proposal_confirmations?.length || 0}/{players.length} Agreed ({proposalTimeLeft}s)
                        </span>
                    </div>
                    <div className="flex gap-2">
                        {game.solve_proposal_confirmations?.includes(user?.id) ? (
                            <button
                                disabled
                                className="px-3 py-1 bg-gray-400 dark:bg-gray-600 rounded text-xs font-bold text-white cursor-not-allowed"
                            >
                                Confirmed
                            </button>
                        ) : (
                            <button
                                onClick={onConfirmSolving}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-bold text-white transition-colors"
                            >
                                Confirm
                            </button>
                        )}
                        <button
                            onClick={onDenySolving}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-bold text-white transition-colors"
                        >
                            Deny
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
}
