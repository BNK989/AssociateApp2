import { MetadataRoute } from 'next'
import { SITE_ORIGIN } from '@/lib/seo/siteUrls'

/**
 * `/admin` and `/settings` are reachable only with a session and have nothing
 * to offer a search result; `/thank-you` is a post-action landing page that
 * makes no sense as an entry point. All three are kept out of the index here
 * and out of the sitemap in `siteUrls.ts` — the two lists have to agree.
 *
 * Each private path is listed twice because the app serves seven locales: the
 * bare path is the default locale's, and the wildcard form beside it catches
 * `/he/admin`, `/ar/admin` and the rest. A rule for the unprefixed form alone leaves
 * six doors open. `/dashboard/`, which the previous list disallowed, is not a
 * route in this app.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: [
                '/api/',
                '/admin/', '/*/admin/',
                '/settings/', '/*/settings/',
                '/thank-you', '/*/thank-you',
            ],
        },
        sitemap: `${SITE_ORIGIN}/sitemap.xml`,
        host: SITE_ORIGIN,
    }
}
