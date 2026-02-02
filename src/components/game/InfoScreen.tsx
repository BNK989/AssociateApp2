import React from 'react';
import { Share, Trophy, HelpCircle, Volume2, VolumeX, Moon, Sun, Globe, Zap, Clock, X, ChevronRight, Settings, Users, Loader2, Info, Check } from 'lucide-react';
import { IosTimePicker } from '@/components/ui/time-picker';
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
import { useTranslations } from 'next-intl';
import { LanguagePicker } from '../LanguagePicker';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { Input } from "@/components/ui/input";

type InfoScreenProps = {
    game: GameState;
    players: Player[];
    user: any;
    onClose: () => void;
    theme?: string;
    date?: string;
    solvedCount?: number;
    onRestartTutorial?: () => void;
    onAutoHintChange?: (enabled: boolean, duration: number) => void;
};

export function InfoScreen({ game, players, user, onClose, theme: dailyTheme, date,
    solvedCount,
    onRestartTutorial,
    onAutoHintChange
}: InfoScreenProps) {
    const t = useTranslations('GameRoom.Info');
    const { user: authUser, profile, refreshProfile } = useAuth();
    const { theme, setTheme } = useTheme();
    const [updating, setUpdating] = React.useState(false);

    // Auto Hint State
    const [autoHintEnabled, setAutoHintEnabled] = React.useState(GAME_CONFIG.DEFAULT_AUTO_HINT_ENABLED);
    const [duration, setDuration] = React.useState(GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION);
    const [isPickerOpen, setIsPickerOpen] = React.useState(false);
    const [audioEnabled, setAudioEnabled] = React.useState<boolean>(true);

    // Initial load sync
    React.useEffect(() => {
        if (authUser && profile?.settings) {
            setAutoHintEnabled(profile.settings.auto_hint_enabled ?? GAME_CONFIG.DEFAULT_AUTO_HINT_ENABLED);
            setDuration(profile.settings.auto_hint_duration ?? GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION);
            setAudioEnabled(profile.settings.enable_audio_chime !== false);
        } else {
            // Guest / LocalStorage
            try {
                const localSettings = localStorage.getItem('daily_game_settings');
                if (localSettings) {
                    const parsed = JSON.parse(localSettings);
                    setAutoHintEnabled(parsed.auto_hint_enabled ?? GAME_CONFIG.DEFAULT_AUTO_HINT_ENABLED);
                    if (parsed.auto_hint_duration !== undefined) {
                        setDuration(parsed.auto_hint_duration);
                    }
                    if (parsed.enable_audio_chime !== undefined) {
                        setAudioEnabled(parsed.enable_audio_chime);
                    }
                }
            } catch (e) {
                console.error("Failed to parse local settings", e);
            }
        }
    }, [authUser, profile]);

    // Local Update - No Side Effects
    const updateAutoHintSettings = (enabled: boolean, newDuration: number) => {
        setAutoHintEnabled(enabled);
        setDuration(newDuration);
        onAutoHintChange?.(enabled, newDuration);
    };

    // Save Logic (Triggered on Close)
    const saveSettings = async () => {
        const valToSave = duration;

        if (authUser) {
            setUpdating(true);
            try {
                const { error } = await supabase.from('profiles').update({
                    settings: {
                        ...profile?.settings,
                        auto_hint_enabled: autoHintEnabled,
                        auto_hint_duration: valToSave
                    }
                }).eq('id', authUser.id);

                if (error) throw error;
                await refreshProfile();
            } catch (e: any) {
                console.error("Settings save error:", e);
                // Silent fail or toast
            } finally {
                setUpdating(false);
            }
        } else {
            // Guest Mode
            const settings = {
                auto_hint_enabled: autoHintEnabled,
                auto_hint_duration: valToSave
            };
            localStorage.setItem('daily_game_settings', JSON.stringify(settings));
        }
    };

    const handleClose = async () => {
        await saveSettings();
        onClose();
    };

    const toggleAudio = async (checked: boolean) => {
        setAudioEnabled(checked);

        if (authUser) {
            if (updating) return;
            setUpdating(true);
            try {
                const { error } = await supabase.from('profiles').update({
                    settings: { ...profile?.settings, enable_audio_chime: checked }
                }).eq('id', authUser.id);

                if (error) throw error;
                await refreshProfile();
            } catch (e) {
                console.error(e);
                toast.error(t('toast_settings_fail'));
                // Revert check if failed? For now just stay optimistic
            } finally {
                setUpdating(false);
            }
        } else {
            // Guest Mode
            try {
                const localSettings = localStorage.getItem('daily_game_settings');
                let newSettings = {};
                if (localSettings) {
                    try {
                        newSettings = JSON.parse(localSettings);
                    } catch (e) { }
                }
                // @ts-ignore
                newSettings.enable_audio_chime = checked;
                localStorage.setItem('daily_game_settings', JSON.stringify(newSettings));
            } catch (e) { console.error(e) }
        }

        if (checked) {
            const audio = new Audio('/sounds/notifications/chime1.mp3');
            audio.play().catch(e => console.error('Audio play failed', e));
        }
    };

    const toggleTheme = async (checked: boolean) => {
        const newTheme = checked ? 'dark' : 'light';
        setTheme(newTheme);

        if (authUser) {
            await supabase.from('profiles').update({
                settings: { ...profile?.settings, theme: newTheme }
            }).eq('id', authUser.id);
            // No need to refresh immediately for visual change since useTheme handles it, but good for persistence
            refreshProfile();
        }
    };

    // Clean up instructions text
    const instructions = [
        {
            title: t('Classic.overview.title'),
            text: t('Classic.overview.text')
        },
        {
            title: t('Classic.phase1.title'),
            text: t('Classic.phase1.text')
        },
        {
            title: t('Classic.phase2.title'),
            text: t('Classic.phase2.text')
        },
        {
            title: t('Classic.hints.title'),
            text: t('Classic.hints.text')
        },
        {
            title: t('Classic.winning.title'),
            text: t('Classic.winning.text')
        }
    ];

    // Determine if Daily Game
    const isDaily = !!dailyTheme;

    // Daily Game Instructions
    const dailyInstructions = [
        {
            title: t('Daily.folder.title'),
            text: t('Daily.folder.text')
        },
        {
            title: t('Daily.how_to.title'),
            text: t('Daily.how_to.text')
        },
        {
            title: t('Daily.scoring.title'),
            text: t('Daily.scoring.text')
        },
        {
            title: t('Daily.winning.title'),
            text: t('Daily.winning.text')
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
        const text = t('daily_share_text', { date, score: myScore, theme: dailyTheme, url: `${window.location.origin}/daily` });

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
                    toast.success(t('toast_copied'));
                } else {
                    toast.error(t('toast_copy_fail'));
                }
            }
        } catch (error) {
            console.error('Error sharing:', error);
            // Fallback attempt with clipboard if share fails
            const { copyToClipboard } = await import('@/lib/utils');
            const success = await copyToClipboard(text);
            if (success) {
                toast.success(t('toast_copied'));
            } else {
                toast.error(t('toast_share_fail'));
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
                                {t('title')}
                            </>
                        )}
                    </h2>
                </div>
                <div className="flex gap-2">

                    <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-full h-8 w-8 hover:bg-gray-200 dark:hover:bg-gray-800">
                        <X className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6 pb-8 max-w-md mx-auto">

                    {/* Score Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <Trophy className="w-4 h-4" /> {t('scores_title')}
                        </h3>
                        <div className={`grid ${isDaily ? 'grid-cols-2' : 'grid-cols-2'} gap-3`}>
                            {!isDaily && (
                                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800/50 flex flex-col items-center justify-center text-center">
                                    <span className="text-xs text-purple-600 dark:text-purple-400 font-bold uppercase mb-1">{t('team_pot')}</span>
                                    <span className="text-3xl font-black text-purple-700 dark:text-purple-300">{game.team_pot || 0}</span>
                                </div>
                            )}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50 flex flex-col items-center justify-center text-center">
                                <span className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase mb-1">{t('your_score')}</span>
                                <span className="text-3xl font-black text-blue-700 dark:text-blue-300">{myScore}</span>
                            </div>

                            {isDaily && (
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800/50 flex flex-col items-center justify-center text-center">
                                    <span className="text-xs text-green-600 dark:text-green-400 font-bold uppercase mb-1">{t('solved')}</span>
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
                                <Users className="w-4 h-4" /> {t('players_title')}
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
                                                        {isMe && <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-bold">{t('you_tag')}</span>}
                                                        {isLeader && <Trophy className="w-3 h-3 text-amber-500 fill-amber-500" />}
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        {player.has_left ? t('status_left') : t('status_active')}
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



                    {/* Settings Section */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800 space-y-4">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <Settings className="w-4 h-4" /> {t('preferences_title')}
                        </h3>

                        {/* 1. Auto Hint Settings */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600 dark:text-amber-400">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">{t('auto_hint_title')}</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">{t('auto_hint_desc')}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {autoHintEnabled && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setIsPickerOpen(!isPickerOpen)}
                                            className={cn(
                                                "h-7 px-2 text-xs font-bold transition-all duration-200 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800",
                                                isPickerOpen && "bg-gray-100 dark:bg-gray-800"
                                            )}
                                        >
                                            {duration === 0 ? t('auto_hint_immediate') : `${duration}s`}
                                            {isPickerOpen ? (
                                                <X className="w-3 h-3 ml-2 text-gray-500" />
                                            ) : (
                                                <ChevronRight className="w-3 h-3 ml-1 transition-transform duration-200" />
                                            )}
                                        </Button>
                                    )}
                                    <Switch
                                        checked={autoHintEnabled}
                                        onCheckedChange={(checked) => {
                                            updateAutoHintSettings(checked, duration);
                                            if (!checked) setIsPickerOpen(false);
                                        }}
                                        disabled={updating}
                                    />
                                </div>
                            </div>

                            {/* Foldable Picker */}
                            <div className={cn(
                                "grid transition-all duration-300 ease-in-out overflow-hidden",
                                autoHintEnabled && isPickerOpen ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 mt-0"
                            )}>
                                <div className="min-h-0 relative">
                                    <div className="w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
                                        <IosTimePicker
                                            key={isPickerOpen ? 'open' : 'closed'}
                                            value={duration}
                                            onChange={(val) => updateAutoHintSettings(true, val)}
                                            immediateLabel={t('auto_hint_immediate')}
                                            height={120}
                                        />
                                        <div
                                            className="h-8 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                            onClick={() => setIsPickerOpen(false)}
                                        >
                                            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Dark Mode */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                                    {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{t('dark_mode_title')}</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('dark_mode_desc')}</span>
                                </div>
                            </div>
                            <Switch
                                checked={theme === 'dark'}
                                onCheckedChange={(checked: boolean) => toggleTheme(checked)}
                            />
                        </div>

                        {/* 3. Game Sounds */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div
                                    className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400 cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors active:scale-95"
                                    onClick={() => {
                                        const audio = new Audio('/sounds/notifications/chime1.mp3');
                                        audio.play().catch(e => console.error('Audio play failed', e));
                                    }}
                                >
                                    {profile?.settings?.enable_audio_chime !== false ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{t('sounds_title')}</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('sounds_desc')}</span>
                                </div>
                            </div>
                            <Switch
                                checked={audioEnabled}
                                onCheckedChange={toggleAudio}
                                disabled={updating}
                            />
                        </div>

                        {/* 4. Language */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
                                    <Globe className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{t('language_title')}</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('language_desc')}</span>
                                </div>
                            </div>
                            <LanguagePicker />
                        </div>
                    </div>



                    {/* Buttons Row: How to Play + Restart Tutorial */}
                    <div className="flex items-center gap-2 pt-2">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button
                                    variant="secondary"
                                    className="flex-1 justify-between h-12 bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100 border border-gray-800 dark:border-gray-700 shadow-sm px-4"
                                >
                                    <div className="flex items-center gap-2">
                                        <HelpCircle className="w-5 h-5" />
                                        <span className="font-bold">{t('how_to_play_title')}</span>
                                    </div>
                                    <ChevronRight className="w-5 h-5 opacity-50 rtl:rotate-180" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                                <div className="space-y-4 pt-4">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2 text-xl font-bold text-purple-600 dark:text-purple-400 mb-4">
                                            <HelpCircle className="w-6 h-6" />
                                            <span>{t('instructions_dialog_title')}</span>
                                        </DialogTitle>
                                    </DialogHeader>

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

                        {isDaily && onRestartTutorial && (
                            <Button
                                variant="outline"
                                className="flex-1 justify-center h-12 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 px-3"
                                onClick={() => {
                                    onClose(); // Close info screen
                                    setTimeout(() => onRestartTutorial(), 100); // Slight delay for smooth transition
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="w-4 h-4 rtl:scale-x-[-1]"
                                    >
                                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                        <path d="M3 3v5h5" />
                                    </svg>
                                    <span className="font-bold text-sm">{t('restart_tutorial')}</span>
                                </div>
                            </Button>
                        )}
                    </div>

                    <div className="space-y-3">
                        {isDaily && (
                            <Button
                                variant="outline"
                                className="w-full py-6 text-lg font-bold border-2"
                                size="lg"
                                onClick={handleShare}
                            >
                                <Share className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0 rtl:scale-x-[-1]" />
                                {t('share_results')}
                            </Button>
                        )}
                        <Button className="w-full py-6 text-lg font-bold shadow-lg shadow-purple-500/20" size="lg" onClick={handleClose}>
                            {t('back_to_game')}
                        </Button>
                    </div>

                </div>
            </div>
        </div>
    );
}
