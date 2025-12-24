import React from 'react';
import { X, Trophy, MessageSquare, Info, Users, HelpCircle, ChevronRight, ChevronDown, Check, User } from 'lucide-react';
import { GameState, Player } from '@/hooks/useGameLogic';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type InfoScreenProps = {
    game: GameState;
    players: Player[];
    user: any;
    onClose: () => void;
};

export function InfoScreen({ game, players, user, onClose }: InfoScreenProps) {
    // Clean up instructions text
    const instructions = [
        {
            title: "Game Overview",
            text: "This is a text-based game to check how well you know each other and each other's associations. We play in two parts:"
        },
        {
            title: "Phase 1: Chatting",
            text: "In the first part, we text similar to how you would in other chatting apps."
        },
        {
            title: "Phase 2: Solving",
            text: "In the second part, we'll try to guess what was the previous word. Each player gets 10 seconds to guess their own previous word text. After 10 seconds, it's a free-for-all and any player can guess!"
        },
        {
            title: "Hints",
            text: "If you don't know the word, hints are available: 1) Word length, 2) Reveal letters, 3) AI context clue. Careful: 3 incorrect guesses exposes the word!"
        },
        {
            title: "Winning",
            text: "The goal is to win by getting the most texts correct in a row."
        }
    ];

    const [openSection, setOpenSection] = React.useState<string | null>(null);

    const toggleSection = (title: string) => {
        setOpenSection(openSection === title ? null : title);
    };

    const myScore = players.find(p => p.user_id === user?.id)?.score || 0;
    const maxScore = Math.max(...players.map(p => p.score || 0));
    const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white/95 dark:bg-gray-950/95 backdrop-blur-md animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Info className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    Game Info
                </h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 hover:bg-gray-200 dark:hover:bg-gray-800">
                    <X className="w-5 h-5" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6 pb-8 max-w-md mx-auto">

                    {/* Score Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <Trophy className="w-4 h-4" /> Scores
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800/50 flex flex-col items-center justify-center text-center">
                                <span className="text-xs text-purple-600 dark:text-purple-400 font-bold uppercase mb-1">Team Pot</span>
                                <span className="text-3xl font-black text-purple-700 dark:text-purple-300">{game.team_pot || 0}</span>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50 flex flex-col items-center justify-center text-center">
                                <span className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase mb-1">Your Score</span>
                                <span className="text-3xl font-black text-blue-700 dark:text-blue-300">{myScore}</span>
                            </div>
                        </div>
                    </div>

                    {/* Players Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <Users className="w-4 h-4" /> Players
                        </h3>
                        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 shadow-sm">
                            {sortedPlayers.map((player) => {
                                const isMe = player.user_id === user?.id;
                                const isLeader = player.score === maxScore && maxScore > 0;

                                return (
                                    <div key={player.user_id} className="flex items-center justify-between p-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar className={cn("w-10 h-10 border-2", isMe ? "border-blue-500" : "border-transparent")}>
                                                <AvatarImage src={player.profiles?.avatar_url} />
                                                <AvatarFallback className="bg-gray-200 dark:bg-gray-800 text-xs">
                                                    {player.profiles?.username?.slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold flex items-center gap-1.5">
                                                    {player.profiles?.username}
                                                    {isMe && <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-bold">YOU</span>}
                                                    {isLeader && <Trophy className="w-3 h-3 text-amber-500 fill-amber-500" />}
                                                </span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    {player.has_left ? 'Left Game' : 'Active'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="font-mono font-bold text-lg text-gray-700 dark:text-gray-300">
                                            {player.score || 0}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* How to Play Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <HelpCircle className="w-4 h-4" /> How to Play
                        </h3>

                        <div className="space-y-2">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button className="w-full justify-between" variant="outline">
                                        <span>Read Instructions</span>
                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                                    <div className="space-y-4 pt-4">
                                        <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-purple-600 dark:text-purple-400 mb-4">
                                                <HelpCircle className="w-6 h-6" />
                                                <span>Game Instructions</span>
                                            </DialogTitle>
                                        </DialogHeader>

                                        <div className="pb-4">

                                        </div>

                                        {instructions.map((item, i) => (
                                            <div key={i} className="space-y-1">
                                                <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">{item.title}</h4>
                                                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                                    {item.text}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>

                    <div className="pt-8">
                        <Button className="w-full py-6 text-lg font-bold shadow-lg shadow-purple-500/20" size="lg" onClick={onClose}>
                            Back to Game
                        </Button>
                    </div>

                </div>
            </div>
        </div>
    );
}
