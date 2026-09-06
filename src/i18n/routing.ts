import { defineRouting } from 'next-intl/routing';
import { defaultLocale, locales } from './locales';

/**
 * next-intl routing config. Kept out of `proxy.ts` so that the request config
 * and the navigation helpers can import it without pulling middleware code
 * into every server render.
 *
 * `localeDetection` and `localeCookie` are next-intl defaults; both are spelled
 * out because they are the behaviour a first-time player actually experiences:
 *
 *   1. a locale prefix already in the URL (`/he/daily`)
 *   2. the `NEXT_LOCALE` cookie, written when a player picks a language
 *   3. the browser's `Accept-Language` header — i.e. their device language
 *   4. `defaultLocale`
 *
 * Because `locales` only lists languages we actually translate, step 3 can no
 * longer land a player on a locale with no messages: an unshipped device
 * language falls through to English instead.
 */
export const routing = defineRouting({
    locales,
    defaultLocale,
    localePrefix: 'as-needed',
    // Detect the device language for first-time visitors.
    localeDetection: true,
    localeCookie: {
        // Remember an explicit language choice across visits.
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
    },
});
