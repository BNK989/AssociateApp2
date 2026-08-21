import { PostHog } from 'posthog-node'
import { createLogger } from '@/lib/logger';

const log = createLogger('posthog/server');

let posthogInstance: PostHog | null = null

export function getPostHogServer() {
    if (!posthogInstance) {
        const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
        const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

        if (!posthogKey) {
            log.warn('init', 'NEXT_PUBLIC_POSTHOG_KEY is missing from environment variables, server analytics disabled')
            // Return a dummy object or throw? Better to not crash the server if tracking fails.
            // But for now we'll rely on it being there.
        }

        posthogInstance = new PostHog(
            posthogKey || 'dummy_key',
            {
                host: posthogHost,
                flushAt: 1,
                flushInterval: 0
            }
        )
    }
    return posthogInstance
}
