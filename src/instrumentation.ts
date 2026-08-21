import { createLogger } from '@/lib/logger';

const log = createLogger('instrumentation');
export async function register() {
    // No-op for initialization
}

export const onRequestError = async (
    err: unknown,
    request: Request,
    context: unknown,
) => {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { getPostHogServer } = await import('./app/posthog-server')
        const posthog = getPostHogServer()

        let distinctId: string | undefined = undefined

        // Attempt to extract distinct_id from PostHog cookie
        const cookieHeader = request.headers.get('cookie')
        if (cookieHeader) {
            const postHogCookieMatch = cookieHeader.match(/ph_phc_.*?_posthog=([^;]+)/)

            if (postHogCookieMatch && postHogCookieMatch[1]) {
                try {
                    const decodedCookie = decodeURIComponent(postHogCookieMatch[1])
                    const postHogData = JSON.parse(decodedCookie)
                    distinctId = postHogData.distinct_id
                } catch (e) {
                    log.error('parse_cookie', 'Failed to parse PostHog cookie', undefined, e)
                }
            }
        }

        if (posthog) {
            posthog.captureException(err, distinctId)
        }
    }
}
