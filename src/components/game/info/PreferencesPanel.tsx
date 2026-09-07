import { Globe, Moon, Settings, Sun, Volume2, VolumeX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { LanguagePicker } from '@/components/LanguagePicker';
import { AutoHintSetting } from './AutoHintSetting';
import { SettingRow } from './SettingRow';

type PreferencesPanelProps = {
    autoHintEnabled: boolean;
    duration: number;
    audioEnabled: boolean;
    /** 0-1 scale on top of the game master's volume. */
    volume: number;
    theme?: string;
    updating: boolean;
    onAutoHintChange: (enabled: boolean, duration: number) => void;
    onToggleAudio: (checked: boolean) => void;
    onVolumeChange: (volume: number) => void;
    /** Fired when the volume slider is released, so dragging is not a chord. */
    onVolumeCommit: () => void;
    onToggleTheme: (checked: boolean) => void;
    onPreviewChime: () => void;
};

/** Auto-hint, theme, sound and language, grouped into one card. */
export function PreferencesPanel({
    autoHintEnabled,
    duration,
    audioEnabled,
    volume,
    theme,
    updating,
    onAutoHintChange,
    onToggleAudio,
    onVolumeChange,
    onVolumeCommit,
    onToggleTheme,
    onPreviewChime,
}: PreferencesPanelProps) {
    const t = useTranslations('GameRoom.Info');

    return (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800 space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-4 h-4" /> {t('preferences_title')}
            </h3>

            <AutoHintSetting
                enabled={autoHintEnabled}
                duration={duration}
                disabled={updating}
                onChange={onAutoHintChange}
            />

            <SettingRow
                icon={theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                tone="blue"
                title={t('dark_mode_title')}
                description={t('dark_mode_desc')}
            >
                <Switch checked={theme === 'dark'} onCheckedChange={onToggleTheme} />
            </SettingRow>

            <SettingRow
                icon={audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                tone="purple"
                title={t('sounds_title')}
                description={t('sounds_desc')}
                onIconClick={onPreviewChime}
            >
                <Switch checked={audioEnabled} onCheckedChange={onToggleAudio} disabled={updating} />
            </SettingRow>

            {/*
              * Only shown once sound is on. A volume slider above a mute switch
              * is a control that visibly does nothing, and players read that as
              * the setting being broken rather than as it being irrelevant.
              */}
            {audioEnabled && (
                <div className="ps-1 pe-1">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            {t('volume_title')}
                        </span>
                        <span className="text-xs tabular-nums text-gray-400">
                            {Math.round(volume * 100)}%
                        </span>
                    </div>
                    <Slider
                        value={[volume]}
                        min={0}
                        max={1}
                        step={0.05}
                        onValueChange={([next]) => onVolumeChange(next)}
                        onValueCommit={onVolumeCommit}
                        aria-label={t('volume_title')}
                    />
                </div>
            )}

            <SettingRow
                icon={<Globe className="w-4 h-4" />}
                tone="green"
                title={t('language_title')}
                description={t('language_desc')}
            >
                <LanguagePicker />
            </SettingRow>
        </div>
    );
}
