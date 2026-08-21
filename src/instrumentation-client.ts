"use client";
import posthog from 'posthog-js'
import { createLogger } from '@/lib/logger';

const log = createLogger('posthog/client');

if (typeof window !== 'undefined') {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

    if (!posthogKey) {
        log.error('init', 'NEXT_PUBLIC_POSTHOG_KEY is missing, client analytics disabled')
    } else {
        posthog.init(posthogKey, {
            api_host: posthogHost,
            person_profiles: 'identified_only',
        })
    }
}
