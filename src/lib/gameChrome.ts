/**
 * Routes whose full-screen game shell replaces the site chrome.
 *
 * The shell is `fixed inset-0`, so it is out of flow: anything the layout still
 * renders (nav, footer) paints *around* it rather than being covered, giving
 * the player a second, live set of navigation controls.
 */
const IMMERSIVE_GAME_ROUTES = ['/game/', '/daily'];

/**
 * True when `pathname` is a game route and the site nav/footer must be hidden.
 *
 * `pathname` must be locale-stripped — use `usePathname` from `@/navigation`,
 * not the raw hook from `next/navigation`. Routing is `localePrefix:
 * 'as-needed'`, so the raw hook yields `/he/daily` and every non-default
 * locale would fail a naive prefix check.
 */
export function isImmersiveGameRoute(pathname: string | null | undefined): boolean {
    if (!pathname) return false;
    return IMMERSIVE_GAME_ROUTES.some((route) => pathname.startsWith(route));
}
