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
import { Trophy, Share2, Users, ArrowRight } from "lucide-react";
import confetti from 'canvas-confetti';
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DailyEndGamePopoverProps = {
    open: boolean;
    score: number;
    totalWords: number;
    date: string;
    onClose: () => void;
};

export function DailyEndGamePopover({ open, score, totalWords, date, onClose }: DailyEndGamePopoverProps) {
    const router = useRouter();
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

    const handleShare = async () => {
        const shareText = `Associ8 Daily Challenge 📅 ${date}\n🏆 Score: ${score} pts\n🧩 Words: ${totalWords}/${totalWords}\n\nCan you beat my score? Play at: ${window.location.origin}/daily`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: 'Associ8 Daily Challenge',
                    text: shareText,
                });
            } else {
                await navigator.clipboard.writeText(shareText);
                toast.success("Results copied to clipboard!");
            }
        } catch (error) {
            console.error('Error sharing:', error);
            try {
                await navigator.clipboard.writeText(shareText);
                toast.success("Results copied to clipboard!");
            } catch (clipboardError) {
                toast.error("Failed to share results");
            }
        }
    };

    const handleSignUp = () => {
        router.push('/');
    };

    return (
        <Dialog open={internalOpen} onOpenChange={setInternalOpen}>
            <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                        Daily Challenge Complete!
                    </DialogTitle>
                    <DialogDescription className="text-center text-gray-400 text-lg">
                        You solved all {totalWords} words!
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-6">
                    {/* Score Display */}
                    <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 rounded-2xl border border-yellow-200 dark:border-yellow-800/30 shadow-inner">
                        <Trophy className="w-12 h-12 text-yellow-500 mb-2 drop-shadow-md" />
                        <span className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-widest">Final Score</span>
                        <div className="text-5xl font-black text-gray-900 dark:text-white mt-1 tabular-nums tracking-tight">
                            {score}
                        </div>
                    </div>

                    {/* Upsell Card */}
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800/30 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Users className="w-24 h-24 text-indigo-500 transform rotate-12 translate-x-4 -translate-y-4" />
                        </div>
                        <div className="relative z-10">
                            <h4 className="font-bold text-indigo-900 dark:text-indigo-300 mb-1 flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Play with Friends?
                            </h4>
                            <p className="text-sm text-indigo-700 dark:text-indigo-400 mb-3 leading-relaxed">
                                Create a free account to host your own games, track stats, and challenge friends!
                            </p>
                            <Button
                                onClick={handleSignUp}
                                size="sm"
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md transition-all active:scale-95"
                            >
                                Sign Up Free <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="sm:justify-center flex-col sm:flex-row gap-3">
                    <Button
                        onClick={handleShare}
                        className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-2 px-8 rounded-full shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2"
                    >
                        <Share2 className="w-4 h-4" />
                        Share Result
                    </Button>
                    <Button
                        onClick={onClose}
                        variant="ghost"
                        className="w-full sm:w-auto text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        Back to Home
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
