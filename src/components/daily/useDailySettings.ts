import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { createLogger } from '@/lib/logger';
import { resolveInfoSettings } from '@/components/game/info/resolveInfoSettings';
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
 * Auto-hint preferences for the daily game, read from the profile for
 * signed-in players and localStorage for guests.
 *
 * Reloaded whenever the info screen closes, since that is where the player
 * changes them. `reload` is exposed for that.
 */
export function useDailySettings(authUser: User | null, isInfoOpen: boolean) {
    const [autoHintEnabled, setAutoHintEnabled] = useState(GAME_CONFIG.DEFAULT_AUTO_HINT_ENABLED);
    const [autoHintDuration, setAutoHintDuration] = useState(GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION);

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

        const resolved = resolveInfoSettings(stored);
        setAutoHintEnabled(resolved.autoHintEnabled);
        setAutoHintDuration(resolved.duration);
    }, [authUser]);

    useEffect(() => {
        reload();
    }, [reload]);

    // Pick up changes made while the info screen was open.
    useEffect(() => {
        if (!isInfoOpen) reload();
    }, [isInfoOpen, reload]);

    return {
        autoHintEnabled,
        autoHintDuration,
        setAutoHintEnabled,
        setAutoHintDuration,
    };
}
