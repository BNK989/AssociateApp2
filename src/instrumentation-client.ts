"use client";
import posthog from 'posthog-js'

if (typeof window !== 'undefined') {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

    if (!posthogKey) {
        console.error('NEXT_PUBLIC_POSTHOG_KEY is missing')
    } else {
        posthog.init(posthogKey, {
            api_host: posthogHost,
            person_profiles: 'identified_only',
        })
    }
}
