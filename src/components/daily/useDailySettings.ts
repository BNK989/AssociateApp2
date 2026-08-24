import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import {
    isGameMasterConfigured,
    resolveHintPolicy,
    type DailyHintPolicy,
} from '@/lib/daily/hintPolicy';
import type { DailyHintSettings } from '@/lib/gameSettings/settingsRow';
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
) {
    // Held as separate scalars rather than one object so the resolved policy
    // keeps a stable identity: it feeds effects that rebuild the board, and a
    // fresh object on every reload would restart the game mid-play.
    const [storedAutoEnabled, setStoredAutoEnabled] = useState<boolean | undefined>(undefined);
    const [storedDuration, setStoredDuration] = useState<number | undefined>(undefined);

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

    return {
        policy,
        /** First-rung delay, which is what the info screen's single slider shows. */
        autoHintDuration: policy.rungs[0].delaySeconds,
        autoHintEnabled: policy.autoEnabled,
        setAutoHint,
    };
}
