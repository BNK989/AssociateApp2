'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { createLogger, DEBUG_STORAGE_KEY, setDebugMode } from '@/lib/logger';

const log = createLogger('settings/debug');

function hasStoredFlag(): boolean {
    try {
        return window.localStorage.getItem(DEBUG_STORAGE_KEY) !== null;
    } catch {
        return false;
    }
}

/**
 * Resolves debug mode once per session, in precedence order:
 *   1. `?debug=1` / `?debug=0` in the URL — the QA escape hatch, works for any
 *      account on any device without touching the profile.
 *   2. A flag already stored in localStorage on this device.
 *   3. `profile.settings.enable_debug_mode`, set by an admin in Settings.
 *
 * Renders nothing. Never surfaces anything to the player.
 */
export default function DebugModeSync() {
    const searchParams = useSearchParams();
    const { profile } = useAuth();
    const debugParam = searchParams.get('debug');

    useEffect(() => {
        if (debugParam === '1' || debugParam === '0') {
            const enabled = debugParam === '1';
            setDebugMode(enabled);
            log.info('resolve_mode', 'Debug mode set from URL parameter', { enabled });
            return;
        }

        if (hasStoredFlag()) return;

        const fromProfile = profile?.settings?.enable_debug_mode;
        if (typeof fromProfile === 'boolean') {
            setDebugMode(fromProfile);
            log.info('resolve_mode', 'Debug mode set from profile settings', { enabled: fromProfile });
        }
    }, [debugParam, profile]);

    return null;
}
