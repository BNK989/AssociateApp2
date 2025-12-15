export async function register() {
    // No-op for initialization
}

export const onRequestError = async (err: any, request: Request, context: any) => {
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
                    console.error('Error parsing PostHog cookie:', e)
                }
            }
        }

        if (posthog) {
            posthog.captureException(err, distinctId)
        }
    }
}
