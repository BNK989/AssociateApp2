import { RotateCcw, Share } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import type { GameState, Player } from '@/hooks/useGameLogic';
import { HowToPlayDialog } from './info/HowToPlayDialog';
import { InfoScreenHeader } from './info/InfoScreenHeader';
import { PlayerList } from './info/PlayerList';
import { PreferencesPanel } from './info/PreferencesPanel';
import { ScoreSummary } from './info/ScoreSummary';
import { useGameInstructions } from './info/gameInstructions';
import { useInfoSettings } from './info/useInfoSettings';
import type { DailyHintPolicy } from '@/lib/daily/hintPolicy';
import { useShareResults } from './info/useShareResults';

type InfoScreenProps = {
    game: GameState;
    players: Player[];
    user: User | null;
    onClose: () => void;
    theme?: string;
    /** Prebuilt spoiler-free result text; when absent the share button is inert. */
    shareText?: string;
    date?: string;
    solvedCount?: number;
    onRestartTutorial?: () => void;
    onAutoHintChange?: (enabled: boolean, duration: number) => void;
    /** Game-master policy the preference defaults are read from. */
    hintPolicy?: DailyHintPolicy;
};

/**
 * Full-screen overlay with scores, preferences and the rules.
 *
 * Serves both game modes: the presence of a `theme` prop marks this as the
 * daily puzzle, which swaps the player list for a solved counter and adds
 * sharing. Preference state lives in useInfoSettings and is persisted when the
 * screen closes.
 */
export function InfoScreen({
    game,
    players,
    user,
    onClose,
    theme: dailyTheme,
    shareText,
    date,
    solvedCount,
    onRestartTutorial,
    onAutoHintChange,
    hintPolicy,
}: InfoScreenProps) {
    const t = useTranslations('GameRoom.Info');
    const isDaily = Boolean(dailyTheme);

    const settings = useInfoSettings(onAutoHintChange, hintPolicy);
    const instructions = useGameInstructions(isDaily);

    const myScore = players.find((p) => p.user_id === user?.id)?.score || 0;
    const share = useShareResults({ shareText });

    const handleClose = async () => {
        await settings.save();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white/95 dark:bg-gray-950/95 backdrop-blur-md animate-in fade-in duration-200">
            <InfoScreenHeader
                isDaily={isDaily}
                date={date}
                dailyTheme={dailyTheme}
                onClose={handleClose}
            />

            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6 pb-8 max-w-md mx-auto">
                    <ScoreSummary
                        game={game}
                        isDaily={isDaily}
                        myScore={myScore}
                        solvedCount={solvedCount}
                    />

                    {!isDaily && <PlayerList players={players} currentUserId={user?.id} />}

                    <PreferencesPanel
                        autoHintEnabled={settings.autoHintEnabled}
                        duration={settings.duration}
                        audioEnabled={settings.audioEnabled}
                        theme={settings.theme}
                        updating={settings.updating}
                        onAutoHintChange={settings.updateAutoHint}
                        onToggleAudio={settings.toggleAudio}
                        onToggleTheme={settings.toggleTheme}
                        onPreviewChime={settings.playChime}
                    />

                    <div className="flex items-center gap-2 pt-2">
                        <HowToPlayDialog instructions={instructions} />

                        {isDaily && onRestartTutorial && (
                            <Button
                                variant="outline"
                                className="flex-1 justify-center h-12 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 px-3"
                                onClick={() => {
                                    onClose();
                                    // Let the overlay finish closing before the tutorial opens.
                                    setTimeout(() => onRestartTutorial(), 100);
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <RotateCcw className="w-4 h-4 rtl:scale-x-[-1]" aria-hidden="true" />
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
                                onClick={share}
                            >
                                <Share className="w-5 h-5 me-2 rtl:scale-x-[-1]" />
                                {t('share_results')}
                            </Button>
                        )}

                        <Button
                            className="w-full py-6 text-lg font-bold shadow-lg shadow-purple-500/20"
                            size="lg"
                            onClick={handleClose}
                        >
                            {t('back_to_game')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
