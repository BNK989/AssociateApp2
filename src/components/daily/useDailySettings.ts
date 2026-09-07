import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import {
    isGameMasterConfigured,
    resolveHintPolicy,
    type DailyHintPolicy,
} from '@/lib/daily/hintPolicy';
import {
    DEFAULT_FEEDBACK_POLICY,
    resolveFeedbackPolicy,
    type DailyFeedbackPolicy,
} from '@/lib/daily/feedbackPolicy';
import type { DailyFeedbackSettings, DailyHintSettings } from '@/lib/gameSettings/settingsRow';
import type { ProfileSettings } from '@/types/app';

const log = createLogger('daily/settings');

const GUEST_SETTINGS_KEY = 'daily_game_settings';

function readGuestSettings(): ProfileSettings {
    try {
        const raw = localStorage.getItem(GUEST_SETTINGS_KEY);
        return raw ? (JSON.parse(raw) as ProfileSettings) : {};
    } catch (e) {
        log.warn('load', 'Failed to parse guest settings', undefined, e);
        return {};
    }
}

/**
 * The hint policy this player is actually playing under.
 *
 * Three sources fold together here: the game master's stored policy, the player's
 * own two preferences (read from the profile for signed-in players and from
 * localStorage for guests), and any PostHog experiment assignment. Which of them
 * wins is `resolveHintPolicy`'s decision, not this hook's — in particular, the
 * player is ignored entirely when the game master has set the scope to `force`.
 *
 * Preferences are reloaded whenever the info screen closes, since that is where
 * the player changes them.
 *
 * A PostHog start-level assignment now loses to a saved game-master policy, so
 * one being dropped is logged rather than left invisible — that override is
 * what made the admin panel's preview disagree with the board players saw.
 */
export function useDailySettings(
    authUser: User | null,
    isInfoOpen: boolean,
    gameMaster: DailyHintSettings,
    experimentStartLevel?: number | null,
    feedbackSettings?: DailyFeedbackSettings,
) {
    // Held as separate scalars rather than one object so the resolved policy
    // keeps a stable identity: it feeds effects that rebuild the board, and a
    // fresh object on every reload would restart the game mid-play.
    const [storedAutoEnabled, setStoredAutoEnabled] = useState<boolean | undefined>(undefined);
    const [storedDuration, setStoredDuration] = useState<number | undefined>(undefined);
    const [storedSound, setStoredSound] = useState<boolean | undefined>(undefined);
    const [storedVolume, setStoredVolume] = useState<number | undefined>(undefined);

    const reload = useCallback(async () => {
        let stored: ProfileSettings = {};

        if (authUser) {
            const { data, error } = await supabase
                .from('profiles')
                .select('settings')
                .eq('id', authUser.id)
                .single();

            if (error) {
                log.warn('load', 'Failed to load profile settings', { user_id: authUser.id }, error);
            }
            stored = (data?.settings as ProfileSettings) ?? {};
        } else {
            stored = readGuestSettings();
        }

        setStoredAutoEnabled(stored.auto_hint_enabled);
        setStoredDuration(stored.auto_hint_duration);
        setStoredSound(stored.enable_audio_chime);
        setStoredVolume(stored.audio_volume);
    }, [authUser]);

    useEffect(() => {
        reload();
    }, [reload]);

    // Pick up changes made while the info screen was open.
    useEffect(() => {
        if (!isInfoOpen) reload();
    }, [isInfoOpen, reload]);

    const policy: DailyHintPolicy = useMemo(
        () => resolveHintPolicy(
            gameMaster,
            { autoEnabled: storedAutoEnabled, duration: storedDuration },
            experimentStartLevel,
        ),
        [gameMaster, storedAutoEnabled, storedDuration, experimentStartLevel],
    );

    // A live experiment that the stored policy outranks. Logged at warn rather
    // than info so it emits without debug mode: an experiment PostHog believes
    // is running but that changes nothing is a configuration mistake somebody
    // has to see, and this line is the only place it surfaces.
    const experimentOverruled = experimentStartLevel !== null
        && experimentStartLevel !== undefined
        && isGameMasterConfigured(gameMaster);

    useEffect(() => {
        if (!experimentOverruled) return;

        log.warn('resolve', 'Auto-hint experiment ignored: the game master has a saved policy', {
            experiment_start_level: experimentStartLevel,
            game_master_start_level: gameMaster.policy.startLevel,
            settings_revision: gameMaster.revision,
        });
    }, [experimentOverruled, experimentStartLevel, gameMaster]);

    /**
     * Applied while the player drags the info screen's controls. The info
     * screen persists them itself on close; this only keeps the running game in
     * step in the meantime.
     */
    const setAutoHint = useCallback((enabled: boolean, duration: number) => {
        setStoredAutoEnabled(enabled);
        setStoredDuration(duration);
    }, []);

    /**
     * The reward feel this player is actually playing under.
     *
     * Resolved here, off the same profile read as the hint policy, rather than
     * in a hook of its own: a second fetch of the same row on every info-screen
     * close is a wasted round trip and a second chance for the two to disagree.
     *
     * Note that unlike the hint policy this can never be forced. A player who
     * muted the game stays muted — see `resolveFeedbackPolicy`.
     */
    const feedback: DailyFeedbackPolicy = useMemo(
        () => resolveFeedbackPolicy(
            feedbackSettings?.policy ?? DEFAULT_FEEDBACK_POLICY,
            { soundEnabled: storedSound, volume: storedVolume },
        ),
        [feedbackSettings, storedSound, storedVolume],
    );

    /** Applied while the info screen's sound controls are being changed. */
    const setAudio = useCallback((enabled: boolean, volume?: number) => {
        setStoredSound(enabled);
        if (volume !== undefined) setStoredVolume(volume);
    }, []);

    return {
        policy,
        feedback,
        setAudio,
        /** First-rung delay, which is what the info screen's single slider shows. */
        autoHintDuration: policy.rungs[0].delaySeconds,
        autoHintEnabled: policy.autoEnabled,
        setAutoHint,
    };
}
