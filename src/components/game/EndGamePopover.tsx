'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Player, Message } from "@/hooks/useGameLogic";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, MessageSquare, Share2 } from "lucide-react";
import confetti from 'canvas-confetti';
import { toast } from "sonner";
import { useEffect, useState } from "react";

type EndGamePopoverProps = {
    open: boolean;
    onClose: () => void;
    players: Player[];
    messages: Message[];
    gameId: string;
    gameHandle?: number;
    teamPot: number;
};

export function EndGamePopover({ open, onClose, players, messages, gameId, gameHandle, teamPot }: EndGamePopoverProps) {

    const [internalOpen, setInternalOpen] = useState(open);

    useEffect(() => {
        setInternalOpen(open);
    }, [open]);

    useEffect(() => {
        if (internalOpen && open) {
            const duration = 3 * 1000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

            const randomInRange = (min: number, max: number) => {
                return Math.random() * (max - min) + min;
            }

            const interval: ReturnType<typeof setInterval> = setInterval(function () {
                const timeLeft = animationEnd - Date.now();

                if (timeLeft <= 0) {
                    return clearInterval(interval);
                }

                const particleCount = 50 * (timeLeft / duration);
                // since particles fall down, start a bit higher than random
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
            }, 250);

            return () => clearInterval(interval);
        }
    }, [internalOpen, open]);

    // Calculate stats
    const totalMessages = messages.length;

    // Sort players by Score
    const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

    // Get Top Streak
    const maxStreak = Math.max(...players.map(p => p.consecutive_correct_guesses || 0));
    const streakPlayer = players.find(p => p.consecutive_correct_guesses === maxStreak && maxStreak > 1);

    const getInitials = (name: string) => {
        return name?.slice(0, 2).toUpperCase() || '??';
    };

    // Share Functionality
    const handleShare = async () => {
        let shareBody = `Associate Game #${gameHandle || '?'}\n`;
        shareBody += `💰 Team Bank: ${teamPot}\n`;
        shareBody += `🏆 Top Score: ${sortedPlayers[0]?.score || 0}\n\n`;
        shareBody += `Leaderboard:\n`;

        sortedPlayers.slice(0, 3).forEach((p, i) => {
            const medals = ['🥇', '🥈', '🥉'];
            shareBody += `${medals[i]} ${p.profiles?.username}: ${p.score}\n`;
        });

        // For clipboard, we still append the link so it's a complete message
        const finalShareText = `${shareBody}\nPlay at: ${window.location.origin}`;

        try {
            if (navigator.share) {
                // Pass everything as text to ensure the summary is shared, not just the link
                await navigator.share({
                    title: 'Associate Game Results',
                    text: finalShareText,
                });
            } else {
                await navigator.clipboard.writeText(finalShareText);
                toast.success("Results copied to clipboard!");
            }
        } catch (error) {
            console.error('Error sharing:', error);
            // Fallback for desktop Safari/Firefox if share fails or is denied
            try {
                await navigator.clipboard.writeText(finalShareText);
                toast.success("Results copied to clipboard!");
            } catch (clipboardError) {
                toast.error("Failed to share results");
            }
        }
    };

    return (
        <Dialog open={internalOpen} onOpenChange={setInternalOpen}>
            <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                        Well Played!
                    </DialogTitle>
                    <DialogDescription className="text-center text-gray-400 text-lg">
                        Game Completed
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-6">
                    {/* Top Stats Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                            <span className="text-gray-400 text-xs uppercase tracking-wider">Messages</span>
                            <div className="flex items-center gap-2 mt-1">
                                <MessageSquare className="w-5 h-5 text-blue-400" />
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">{totalMessages}</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                            <span className="text-gray-400 text-xs uppercase tracking-wider">Team Bank</span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-2xl">💰</span>
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">{teamPot}</span>
                            </div>
                            <span className="text-[10px] text-gray-500 truncate max-w-full px-2">Points accumulated</span>
                        </div>
                    </div>

                    {/* Leaderboard (Score) */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider text-center">Final Scoreboard</h4>
                        <div className="space-y-2">
                            {sortedPlayers.map((player, index) => {
                                return (
                                    <div key={player.user_id} className={`flex items-center justify-between p-3 rounded-lg border ${index === 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700/50' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'}`}>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-lg font-bold w-6 text-center ${index === 0 ? 'text-yellow-600 dark:text-yellow-500' : 'text-gray-400'}`}>
                                                #{index + 1}
                                            </span>
                                            <div className="relative">
                                                <Avatar className={`w-10 h-10 border-2 ${index === 0 ? 'border-yellow-400' : 'border-gray-200 dark:border-gray-700'}`}>
                                                    <AvatarImage src={player.profiles?.avatar_url} />
                                                    <AvatarFallback className="bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">{getInitials(player.profiles?.username || '')}</AvatarFallback>
                                                </Avatar>
                                                {index === 0 && (
                                                    <div className="absolute -top-2 -right-2 bg-yellow-500 text-white p-1 rounded-full shadow-sm">
                                                        <Trophy className="w-3 h-3" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`font-bold ${index === 0 ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}>
                                                    {player.profiles?.username}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className={`text-xl font-bold ${index === 0 ? 'text-yellow-600 dark:text-yellow-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {player.score}
                                            </span>
                                            <span className="text-[10px] text-gray-400">pts</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <DialogFooter className="sm:justify-center flex-col sm:flex-row gap-3">
                    <Button
                        onClick={handleShare}
                        className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-2 px-8 rounded-full shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2"
                    >
                        <Share2 className="w-4 h-4" />
                        Share Results
                    </Button>
                    <Button
                        onClick={onClose}
                        variant="outline"
                        className="w-full sm:w-auto border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                    >
                        Back to Lobby
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
