import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from 'next-intl/middleware';
import { createLogger } from '@/lib/logger';
import { routing } from '@/i18n/routing';

const log = createLogger('proxy');

// Re-exported for the modules that historically imported `routing` from here.
// New code should import from '@/i18n/routing'.
export { routing };

const intlMiddleware = createMiddleware(routing);

export async function proxy(request: NextRequest) {
    // 1. Run next-intl middleware first to handle routing and locals
    const response = intlMiddleware(request);

    // 2. Run Supabase auth logic
    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            request.cookies.set(name, value)
                        );
                        // Update the response from intlMiddleware
                        cookiesToSet.forEach(({ name, value, options }) =>
                            response.cookies.set(name, value, options)
                        );
                    },
                },
            }
        );

        // Refresh session if expired
        await supabase.auth.getUser();

    } catch (err) {
        log.error('auth', 'Proxy auth check failed', undefined, err);
    }

    return response;
}

export const config = {
    // The catch-all below already covers every locale-prefixed path, so the
    // matcher deliberately does NOT restate the locale list — that duplicate
    // is what drifted out of sync with `routing.locales` before.
    matcher: [
        '/',
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav|ogg|json|js)$).*)",
    ],
};
