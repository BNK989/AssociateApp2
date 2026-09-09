/**
 * Sharing the game itself — not a result.
 *
 * The daily grid in `src/lib/daily/dailyShare.ts` shares *how a round went*.
 * This module shares *the game*, which is a different job: the recipient has
 * never played, so the payload is a one-line pitch plus a link that has to
 * survive being pasted into a chat app.
 *
 * It exists mostly for players who installed the PWA. Once the app runs
 * standalone there is no address bar, so the URL is genuinely unreachable —
 * they cannot pass the game on even when they want to.
 */

/** Query parameter appended to a shared link so PostHog can attribute arrivals. */
export const SHARE_REF_PARAM = 'ref';

/**
 * Where a share was started from.
 *
 * Carried into the link and onto the analytics event, so the two can be joined:
 * which surface produced the share, and which produced an arrival.
 */
export type ShareSurface = 'landing_header' | 'lobby_header' | 'lobby_card';

/**
 * The link to hand out.
 *
 * Always the site root: a newcomer needs the front door, not a deep link into
 * a game they are not in. `?ref=` is additive and read by nothing in the app —
 * it rides along in `$current_url` for analytics only, so a link stripped of it
 * still works.
 */
export function buildAppShareUrl(baseUrl: string, surface: ShareSurface): string {
    try {
        const url = new URL(baseUrl);
        url.searchParams.set(SHARE_REF_PARAM, surface);
        return url.toString();
    } catch {
        // Not absolute — nothing to parse. Append by hand rather than lose the link.
        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}${SHARE_REF_PARAM}=${surface}`;
    }
}

/**
 * The clipboard fallback's payload.
 *
 * The native share sheet takes text and URL as separate fields; the clipboard
 * takes one string, so the two are joined here. The blank line before the link
 * is the same convention the daily grid uses — chat clients attach the preview
 * to a link that stands on its own line.
 */
export function buildAppShareMessage(message: string, url: string): string {
    return [message, '', url].join('\n');
}

/**
 * Did the player close the share sheet, or did the share fail?
 *
 * A dismissal is an ordinary outcome and must stay silent: falling back to the
 * clipboard there would hand a toast to someone who just said no. The Web Share
 * API signals it with `AbortError`; some browsers reject with a bare string or
 * a `DOMException` that carries the word in its message instead.
 */
export function isShareDismissal(error: unknown): boolean {
    if (error instanceof Error) {
        return error.name === 'AbortError' || /abort|cancel/i.test(error.message);
    }
    return typeof error === 'string' && /abort|cancel/i.test(error);
}
