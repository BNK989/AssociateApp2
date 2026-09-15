import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '@/lib/seo/ogCard';

/**
 * The card for every page under `[locale]` that does not override it.
 *
 * A file-convention `opengraph-image` only wins if the metadata object does not
 * name an image of its own, which is why `src/app/[locale]/layout.tsx` no longer
 * lists one.
 */
export const alt = 'Associ8 — the daily word association game';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
    return renderOgCard({
        headline: 'Associ8',
        subhead: 'Eight words, one chain. A new puzzle every day.',
    });
}
