import { MetadataRoute } from 'next'
import { buildSitemapEntries } from '@/lib/seo/siteUrls'

/**
 * The rules live in `src/lib/seo/siteUrls.ts` so they can be tested; this file
 * only supplies the timestamp. See that module for why every locale is listed
 * and why the default one is never prefixed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    return buildSitemapEntries(new Date())
}
