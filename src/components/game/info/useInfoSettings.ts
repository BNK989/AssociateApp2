import { useCallback, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { createLogger } from '@/lib/logger';
import { useAuth } from '@/context/AuthProvider';
import type { ProfileSettings } from '@/types/app';
import { resolveInfoSettings } from './resolveInfoSettings';

const log = createLogger('game/info');

/** Guests keep their preferences here; signed-in players use `profiles.settings`. */
const GUEST_SETTINGS_KEY = 'daily_game_settings';
const CHIME_SRC = '/sounds/notifications/chime1.mp3';

function readGuestSettings(): ProfileSettings {
    try {
        const raw = localStorage.getItem(GUEST_SETTINGS_KEY);
        return raw ? (JSON.parse(raw) as ProfileSettings) : {};
    } catch (e) {
        log.error('load_settings', 'Failed to parse local settings from localStorage', undefined, e);
        return {};
    }
}

function writeGuestSettings(patch: ProfileSettings): void {
    try {
        localStorage.setItem(
            GUEST_SETTINGS_KEY,
            JSON.stringify({ ...readGuestSettings(), ...patch }),
        );
    } catch (e) {
        log.error('save_settings', 'Failed to persist guest settings to localStorage', undefined, e);
    }
}

function playChime(): void {
    new Audio(CHIME_SRC)
        .play()
        .catch((e) => log.warn('play_audio', 'Chime playback failed', undefined, e));
}

/**
 * Player preferences shown in the info screen, backed by the profile row for
 * signed-in players and by localStorage for guests.
 *
 * Auto-hint changes are applied locally as the player fiddles with them and
 * only persisted on close — the time picker would otherwise write on every tick.
 * The audio and theme toggles persist immediately, since each is a single act.
 */
export function useInfoSettings(onAutoHintChange?: (enabled: boolean, duration: number) => void) {
    const t = useTranslations('GameRoom.Info');
    const { user: authUser, profile, refreshProfile } = useAuth();
    const { theme, setTheme } = useTheme();

    const [updating, setUpdating] = useState(false);
    const [autoHintEnabled, setAutoHintEnabled] = useState(GAME_CONFIG.DEFAULT_AUTO_HINT_ENABLED);
    const [duration, setDuration] = useState(GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION);
    const [audioEnabled, setAudioEnabled] = useState(true);

    useEffect(() => {
        const stored: ProfileSettings = authUser && profile?.settings
            ? profile.settings
            : readGuestSettings();
        const resolved = resolveInfoSettings(stored);

        setAutoHintEnabled(resolved.autoHintEnabled);
        setDuration(resolved.duration);
        setAudioEnabled(resolved.audioEnabled);
    }, [authUser, profile]);

    /** Applied immediately so the game reacts; persisted later by `save()`. */
    const updateAutoHint = useCallback((enabled: boolean, newDuration: number) => {
        setAutoHintEnabled(enabled);
        setDuration(newDuration);
        onAutoHintChange?.(enabled, newDuration);
    }, [onAutoHintChange]);

    const save = useCallback(async () => {
        const patch: ProfileSettings = {
            auto_hint_enabled: autoHintEnabled,
            auto_hint_duration: duration,
        };

        if (!authUser) {
            writeGuestSettings(patch);
            return;
        }

        setUpdating(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ settings: { ...profile?.settings, ...patch } })
                .eq('id', authUser.id);

            if (error) throw error;
            await refreshProfile();
        } catch (e: unknown) {
            log.error('save_settings', 'Failed to save settings', { user_id: authUser.id }, e);
        } finally {
            setUpdating(false);
        }
    }, [authUser, profile?.settings, autoHintEnabled, duration, refreshProfile]);

    const toggleAudio = useCallback(async (checked: boolean) => {
        setAudioEnabled(checked);

        if (!authUser) {
            writeGuestSettings({ enable_audio_chime: checked });
        } else if (!updating) {
            setUpdating(true);
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ settings: { ...profile?.settings, enable_audio_chime: checked } })
                    .eq('id', authUser.id);

                if (error) throw error;
                await refreshProfile();
            } catch (e) {
                log.error('toggle_chime', 'Failed to save audio chime preference', { user_id: authUser.id }, e);
                toast.error(t('toast_settings_fail'));
            } finally {
                setUpdating(false);
            }
        }

        if (checked) playChime();
    }, [authUser, profile?.settings, updating, refreshProfile, t]);

    const toggleTheme = useCallback(async (checked: boolean) => {
        const newTheme = checked ? 'dark' : 'light';
        setTheme(newTheme);

        if (!authUser) return;

        // next-themes drives the visual change; this is purely for persistence.
        await supabase
            .from('profiles')
            .update({ settings: { ...profile?.settings, theme: newTheme } })
            .eq('id', authUser.id);
        refreshProfile();
    }, [authUser, profile?.settings, setTheme, refreshProfile]);

    return {
        updating,
        autoHintEnabled,
        duration,
        audioEnabled,
        theme,
        updateAutoHint,
        save,
        toggleAudio,
        toggleTheme,
        playChime,
    };
}
