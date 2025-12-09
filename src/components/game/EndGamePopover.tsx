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
import { Trophy, MessageSquare } from "lucide-react";
import confetti from 'canvas-confetti';
import { useEffect, useState } from "react";

type EndGamePopoverProps = {
    open: boolean;
    onClose: () => void;
    players: Player[];
    messages: Message[];
};

export function EndGamePopover({ open, onClose, players, messages }: EndGamePopoverProps) {

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

    // Calculate solvers
    const solverCounts = messages.reduce((acc, msg) => {
        // Placeholder for solver tracking if we had it
        return acc;
    }, {} as Record<string, number>);

    const messageCounts = messages.reduce((acc, msg) => {
        acc[msg.user_id] = (acc[msg.user_id] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const sortedPlayers = [...players].sort((a, b) => {
        const countA = messageCounts[a.user_id] || 0;
        const countB = messageCounts[b.user_id] || 0;
        return countB - countA;
    });

    const getInitials = (name: string) => {
        return name?.slice(0, 2).toUpperCase() || '??';
    };

    return (
        <Dialog open={internalOpen} onOpenChange={setInternalOpen}>
            <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                        Well Played!
                    </DialogTitle>
                    <DialogDescription className="text-center text-gray-400 text-lg">
                        All messages have been decoded.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-6">
                    {/* Total Messages */}
                    <div className="flex flex-col items-center justify-center p-4 bg-gray-100 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                        <span className="text-gray-400 text-sm uppercase tracking-wider">Total Messages</span>
                        <div className="flex items-center gap-2 mt-1">
                            <MessageSquare className="w-6 h-6 text-blue-400" />
                            <span className="text-4xl font-bold text-gray-900 dark:text-white">{totalMessages}</span>
                        </div>
                    </div>

                    {/* Leaderboard (Most Active) */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider text-center">Most Active Chatters</h4>
                        <div className="space-y-2">
                            {sortedPlayers.slice(0, 3).map((player, index) => {
                                const msgCount = messageCounts[player.user_id] || 0;
                                return (
                                    <div key={player.user_id} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <Avatar className="w-10 h-10 border-2 border-gray-700">
                                                    <AvatarImage src={player.profiles?.avatar_url} />
                                                    <AvatarFallback className="bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">{getInitials(player.profiles?.username || '')}</AvatarFallback>
                                                </Avatar>
                                                {index === 0 && (
                                                    <div className="absolute -top-2 -right-2 bg-yellow-500 text-black p-1 rounded-full">
                                                        <Trophy className="w-3 h-3" />
                                                    </div>
                                                )}
                                            </div>
                                            <span className="font-medium text-gray-900 dark:text-white">{player.profiles?.username}</span>
                                        </div>
                                        <span className="text-xl font-bold text-gray-700 dark:text-gray-300">{msgCount}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <DialogFooter className="sm:justify-center">
                    <Button
                        onClick={onClose}
                        className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-2 px-8 rounded-full shadow-lg transform transition hover:scale-105"
                    >
                        Back to Lobby
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
