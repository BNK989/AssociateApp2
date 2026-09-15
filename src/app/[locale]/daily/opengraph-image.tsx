import { dailyPuzzleNumber } from '@/lib/daily/dailyShare';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '@/lib/seo/ogCard';

/**
 * The card a shared result grid turns into — the link most often pasted into a
 * chat, so it is the one worth naming the day on.
 *
 * The puzzle number is derived from the date alone (`dailyPuzzleNumber` counts
 * days from `DAILY_EPOCH`), so this route touches no database. An image route
 * that queried Supabase would fail open to a blank card exactly when a crawler
 * is impatient, and would answer a preview fetch with a cold read for no gain.
 *
 * Today is read in UTC, matching how `daily/page.tsx` picks the day's puzzle;
 * the two must name the same number or the preview will contradict the page.
 */
export const alt = 'Associ8 — today\'s daily word chain';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
    const today = new Date().toISOString().split('T')[0];

    return renderOgCard({
        // The brand rides on the eyebrow: a card pasted into a chat is seen
        // before the site name beneath it is read.
        eyebrow: `ASSOCI8  ·  PUZZLE #${dailyPuzzleNumber(today)}`,
        headline: 'Today\'s chain',
        subhead: 'Eight words, each one linked to the last. Can you connect them all?',
    });
}
