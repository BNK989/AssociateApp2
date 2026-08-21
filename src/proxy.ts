import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from 'next-intl/middleware';
import { defineRouting } from 'next-intl/routing';
import { createLogger } from '@/lib/logger';

const log = createLogger('proxy');

export const routing = defineRouting({
    locales: ['en', 'he', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', 'ru', 'ar', 'hi', 'tr', 'nl', 'pl', 'sv', 'vi', 'th', 'ro'],
    defaultLocale: 'en',
    localePrefix: 'as-needed'
});

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
    matcher: [
        '/',
        '/(he|en|es|fr|de|it|pt|ja|zh|ru|ar|hi|tr|nl|pl|sv|vi|th)/:path*',
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav|ogg|json|js)$).*)",
    ],
};
