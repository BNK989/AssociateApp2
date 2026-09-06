import { useEffect } from 'react';
import { usePostHog, useFeatureFlagPayload } from 'posthog-js/react';
import { createLogger } from '@/lib/logger';

const log = createLogger('daily/client');

/**
 * The start level assigned by the PostHog experiment, or null when the player
 * is not in one.
 *
 * Since game-master controls landed, this flag is an experiment surface only:
 * the day-to-day value lives in `game_settings` and is edited from the admin
 * panel. Returning null rather than 0 is what keeps the two apart — an
 * unassigned player must fall through to the game master's policy instead of
 * silently overriding it with zero.
 */
export function useExperimentStartLevel(): number | null {
    const payload = useFeatureFlagPayload('dailygame-auto-hint-level');
    const posthog = usePostHog();

    const level = typeof payload === 'object' && payload !== null && 'initialHintCount' in payload
        ? (payload as { initialHintCount: number }).initialHintCount
        : null;

    useEffect(() => {
        if (level === null) return;
        log.debug('feature_flag', 'Auto-hint experiment assigned a start level', {
            resolved_level: level,
            variant: String(posthog.getFeatureFlag('dailygame-auto-hint-level')),
        });
    }, [level, posthog]);

    return level;
}
