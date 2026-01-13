import React from 'react';
import { X, Trophy, MessageSquare, Info, Users, HelpCircle, ChevronRight, ChevronDown, Check, User, Share, Settings, Volume2, VolumeX, Moon, Sun } from 'lucide-react';
import { GameState, Player } from '@/hooks/useGameLogic';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { useAuth } from '@/context/AuthProvider';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabase';
import { Switch } from "../ui/switch";

type InfoScreenProps = {
    game: GameState;
    players: Player[];
    user: any;
    onClose: () => void;
    theme?: string;
    date?: string;
    solvedCount?: number;
};

export function InfoScreen({ game, players, user, onClose, theme: dailyTheme, date, solvedCount }: InfoScreenProps) {
    const { profile, refreshProfile } = useAuth();
    const { theme, setTheme } = useTheme();
    const [updating, setUpdating] = React.useState(false);

    const toggleAudio = async (checked: boolean) => {
        if (!user || updating) return;
        setUpdating(true);
        // Optimistic update handled by switch state if wired to profile, but profile update is async.
        // We'll trust fast server response or just let it lag slightly.
        try {
            const { error } = await supabase.from('profiles').update({
                settings: { ...profile?.settings, enable_audio_chime: checked }
            }).eq('id', user.id);

            if (error) throw error;
            await refreshProfile();
            toast.success(`Audio ${checked ? 'enabled' : 'disabled'}`);
        } catch (e) {
            console.error(e);
            toast.error("Failed to update settings");
        } finally {
            setUpdating(false);
        }
    };

    const toggleTheme = async (checked: boolean) => {
        const newTheme = checked ? 'dark' : 'light';
        setTheme(newTheme);

        if (user) {
            await supabase.from('profiles').update({
                settings: { ...profile?.settings, theme: newTheme }
            }).eq('id', user.id);
            // No need to refresh immediately for visual change since useTheme handles it, but good for persistence
            refreshProfile();
        }
    };

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

    // Determine if Daily Game
    const isDaily = !!dailyTheme;

    // Daily Game Instructions
    const dailyInstructions = [
        {
            title: "Daily Challenge Folder",
            text: "Welcome to the Daily Chain! Each day brings a new theme and a set of words to solve."
        },
        {
            title: "How to Play",
            text: "Guess the hidden words related to today's theme. The words are chained together by association."
        },
        {
            title: "Scoring",
            text: "Solve words with fewer hints for more points. Maintain a streak of correct guesses to multiply your score!"
        },
        {
            title: "Winning",
            text: "Complete all words to finish the daily challenge. Come back tomorrow for a new one!"
        }
    ];

    const displayInstructions = isDaily ? dailyInstructions : instructions;

    const [openSection, setOpenSection] = React.useState<string | null>(null);

    const toggleSection = (title: string) => {
        setOpenSection(openSection === title ? null : title);
    };

    const myScore = players.find(p => p.user_id === user?.id)?.score || 0;
    const maxScore = Math.max(...players.map(p => p.score || 0));
    const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));



    const handleShare = async () => {
        if (!isDaily || !date) return;
        const text = `Daily Chain ${date}\nScore: ${myScore}\nTheme: ${dailyTheme}\n\nPlay at: ${window.location.origin}/daily`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: 'Daily Chain Results',
                    text: text,
                });
            } else {
                const { copyToClipboard } = await import('@/lib/utils');
                const success = await copyToClipboard(text);
                if (success) {
                    toast.success("Copied to clipboard!");
                } else {
                    toast.error("Failed to copy to clipboard");
                }
            }
        } catch (error) {
            console.error('Error sharing:', error);
            // Fallback attempt with clipboard if share fails
            const { copyToClipboard } = await import('@/lib/utils');
            const success = await copyToClipboard(text);
            if (success) {
                toast.success("Copied to clipboard!");
            } else {
                toast.error("Failed to share results");
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white/95 dark:bg-gray-950/95 backdrop-blur-md animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex flex-col">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        {isDaily ? (
                            <span className="flex flex-col items-start leading-tight">
                                <span className="text-xs uppercase text-purple-600 dark:text-purple-400 font-extrabold tracking-wider">{date}</span>
                                <span className="text-lg">{dailyTheme}</span>
                            </span>
                        ) : (
                            <>
                                <Info className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                Game Info
                            </>
                        )}
                    </h2>
                </div>
                <div className="flex gap-2">

                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 hover:bg-gray-200 dark:hover:bg-gray-800">
                        <X className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6 pb-8 max-w-md mx-auto">

                    {/* Score Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <Trophy className="w-4 h-4" /> Scores
                        </h3>
                        <div className={`grid ${isDaily ? 'grid-cols-2' : 'grid-cols-2'} gap-3`}>
                            {!isDaily && (
                                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800/50 flex flex-col items-center justify-center text-center">
                                    <span className="text-xs text-purple-600 dark:text-purple-400 font-bold uppercase mb-1">Team Pot</span>
                                    <span className="text-3xl font-black text-purple-700 dark:text-purple-300">{game.team_pot || 0}</span>
                                </div>
                            )}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50 flex flex-col items-center justify-center text-center">
                                <span className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase mb-1">Your Score</span>
                                <span className="text-3xl font-black text-blue-700 dark:text-blue-300">{myScore}</span>
                            </div>

                            {isDaily && (
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800/50 flex flex-col items-center justify-center text-center">
                                    <span className="text-xs text-green-600 dark:text-green-400 font-bold uppercase mb-1">Solved</span>
                                    <span className="text-3xl font-black text-green-700 dark:text-green-300">
                                        {solvedCount || 0}<span className="text-lg opacity-50">/{game.max_messages || 0}</span>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Players Section (Classic Only) */}
                    {!isDaily && (
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
                    )}

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

                                        {displayInstructions.map((item: any, i: number) => (
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

                    {/* Settings Section */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800 space-y-4">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <Settings className="w-4 h-4" /> Preferences
                        </h3>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
                                    {profile?.settings?.enable_audio_chime !== false ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">Game Sounds</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Play chimes for turns</span>
                                </div>
                            </div>
                            <Switch
                                checked={profile?.settings?.enable_audio_chime !== false}
                                onCheckedChange={toggleAudio}
                                disabled={updating}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                                    {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">Dark Mode</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Adjust appearance</span>
                                </div>
                            </div>
                            <Switch
                                checked={theme === 'dark'}
                                onCheckedChange={(checked: boolean) => toggleTheme(checked)}
                            />
                        </div>
                    </div>

                    <div className="pt-8 space-y-3">
                        {isDaily && (
                            <Button
                                variant="outline"
                                className="w-full py-6 text-lg font-bold border-2"
                                size="lg"
                                onClick={handleShare}
                            >
                                <Share className="w-5 h-5 mr-2" />
                                Share Results
                            </Button>
                        )}
                        <Button className="w-full py-6 text-lg font-bold shadow-lg shadow-purple-500/20" size="lg" onClick={onClose}>
                            Back to Game
                        </Button>
                    </div>

                </div>
            </div>
        </div >
    );
}
