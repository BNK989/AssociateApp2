import { useCallback, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { DEFAULT_HINT_POLICY, type DailyHintPolicy } from '@/lib/daily/hintPolicy';
import { createLogger } from '@/lib/logger';
import { useAuth } from '@/context/AuthProvider';
import type { ProfileSettings } from '@/types/app';
import type { SolveTier } from '@/lib/daily/feedbackTiers';
import { resolveInfoSettings } from './resolveInfoSettings';

const log = createLogger('game/info');

/** Guests keep their preferences here; signed-in players use `profiles.settings`. */
const GUEST_SETTINGS_KEY = 'daily_game_settings';

/** The tier previewed when the player changes a sound control. */
const PREVIEW_TIER: SolveTier = 'clean';

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

type UseInfoSettingsArgs = {
    onAutoHintChange?: (enabled: boolean, duration: number) => void;
    policy?: DailyHintPolicy;
    /** Applies a sound change to the running game before it is persisted. */
    onAudioChange?: (enabled: boolean, volume?: number) => void;
    /** Plays a sample so the player hears what they just changed. */
    onPreviewSound?: (tier: SolveTier) => void;
};

/**
 * Player preferences shown in the info screen, backed by the profile row for
 * signed-in players and by localStorage for guests.
 *
 * Auto-hint and volume changes are applied locally as the player fiddles with
 * them and only persisted on close — a slider would otherwise write on every
 * tick. The sound and theme toggles persist immediately, since each is a single
 * act.
 */
export function useInfoSettings({
    onAutoHintChange,
    policy = DEFAULT_HINT_POLICY,
    onAudioChange,
    onPreviewSound,
}: UseInfoSettingsArgs = {}) {
    const t = useTranslations('GameRoom.Info');
    const { user: authUser, profile, refreshProfile } = useAuth();
    const { theme, setTheme } = useTheme();

    const [updating, setUpdating] = useState(false);
    const [autoHintEnabled, setAutoHintEnabled] = useState(policy.autoEnabled);
    const [duration, setDuration] = useState(policy.rungs[0].delaySeconds);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [volume, setVolume] = useState(1);

    useEffect(() => {
        const stored: ProfileSettings = authUser && profile?.settings
            ? profile.settings
            : readGuestSettings();
        const resolved = resolveInfoSettings(stored, policy);

        setAutoHintEnabled(resolved.autoHintEnabled);
        setDuration(resolved.duration);
        setAudioEnabled(resolved.audioEnabled);
        setVolume(resolved.volume);
    }, [authUser, profile, policy]);

    /**
     * Merges a patch into `profiles.settings`.
     *
     * Deliberately spreads the existing blob: `settings` is a single jsonb
     * column, so writing a bare patch would drop every preference not named in
     * it.
     */
    const persist = useCallback(async (patch: ProfileSettings) => {
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
        } catch (e) {
            log.error('save_settings', 'Failed to save settings', {
                user_id: authUser.id,
                fields: Object.keys(patch).join(','),
            }, e);
            toast.error(t('toast_settings_fail'));
        } finally {
            setUpdating(false);
        }
    }, [authUser, profile?.settings, refreshProfile, t]);

    /** Applied immediately so the game reacts; persisted later by `save()`. */
    const updateAutoHint = useCallback((enabled: boolean, newDuration: number) => {
        setAutoHintEnabled(enabled);
        setDuration(newDuration);
        onAutoHintChange?.(enabled, newDuration);
    }, [onAutoHintChange]);

    /** Persists what the screen holds. Called when the info screen closes. */
    const save = useCallback(
        () => persist({
            auto_hint_enabled: autoHintEnabled,
            auto_hint_duration: duration,
            audio_volume: volume,
        }),
        [persist, autoHintEnabled, duration, volume],
    );

    const toggleAudio = useCallback(async (checked: boolean) => {
        setAudioEnabled(checked);
        onAudioChange?.(checked, volume);

        // A single deliberate act, so it lands now rather than on close: a
        // player who mutes and then closes the tab should stay muted.
        await persist({ enable_audio_chime: checked });

        if (checked) onPreviewSound?.(PREVIEW_TIER);
    }, [persist, onAudioChange, onPreviewSound, volume]);

    /** Live while dragging; written by `save()` when the screen closes. */
    const updateVolume = useCallback((next: number) => {
        setVolume(next);
        onAudioChange?.(audioEnabled, next);
    }, [onAudioChange, audioEnabled]);

    /** Fired on release rather than on every tick, so dragging is not a chord. */
    const previewVolume = useCallback(() => {
        if (audioEnabled) onPreviewSound?.(PREVIEW_TIER);
    }, [audioEnabled, onPreviewSound]);

    const toggleTheme = useCallback(async (checked: boolean) => {
        const newTheme = checked ? 'dark' : 'light';
        setTheme(newTheme);

        if (!authUser) return;

        // next-themes drives the visual change; this is purely for persistence.
        await persist({ theme: newTheme });
    }, [authUser, setTheme, persist]);

    return {
        updating,
        autoHintEnabled,
        duration,
        audioEnabled,
        volume,
        theme,
        updateAutoHint,
        save,
        toggleAudio,
        updateVolume,
        previewVolume,
        toggleTheme,
    };
}
