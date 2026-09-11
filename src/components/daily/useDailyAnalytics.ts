import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePostHog } from 'posthog-js/react';
import { createLogger } from '@/lib/logger';
import {
    dailyEvent,
    type DailyContext,
    type DailyEventName,
    type DailyEventProps,
} from '@/lib/daily/dailyAnalytics';

const log = createLogger('daily/analytics');

type UseDailyAnalyticsArgs = DailyContext;

/**
 * The daily game's only route to PostHog.
 *
 * Two jobs. It stamps the shared context onto every event, so any two daily
 * events can be compared or funnelled without one of them missing the property
 * the comparison needs. And it swallows a capture failure: analytics is
 * instrumentation, and a broken SDK must never take a player's game down with
 * it — the failure is logged with the event name so it is recoverable from the
 * debugger rather than silent (CLAUDE.md §8).
 *
 * The context is read through a ref so that `track` keeps a stable identity.
 * `settings_revision` arrives partway through a game; without the ref every
 * consumer's `useCallback` would rebuild at that moment, which is how an effect
 * that fires once ends up firing twice.
 */
export function useDailyAnalytics(context: UseDailyAnalyticsArgs) {
    const posthog = usePostHog();

    const contextRef = useRef(context);
    useEffect(() => {
        contextRef.current = context;
    }, [context]);

    const track = useCallback(<N extends DailyEventName>(
        name: N,
        props: DailyEventProps[N],
    ) => {
        try {
            const event = dailyEvent(contextRef.current, name, props);
            posthog?.capture(event.name, event.properties);
        } catch (e) {
            log.warn('capture', `Failed to capture daily event "${name}", continuing`, {
                play_date: contextRef.current.play_date,
                event: name,
            }, e);
        }
    }, [posthog]);

    return useMemo(() => ({ track }), [track]);
}

export type DailyTracker = ReturnType<typeof useDailyAnalytics>;
