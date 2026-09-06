"use client"

import { usePathname } from "@/navigation";
import { Toaster } from "@/components/ui/sonner";
import { isImmersiveGameRoute } from "@/lib/gameChrome";

/**
 * Clearance for the composer at the foot of the board.
 *
 * The game shell is `fixed inset-0` with the input row as its last child, so a
 * bottom-anchored toast would land on top of it. 65px is that row plus a gap.
 */
const GAME_INPUT_CLEARANCE = '65px';

/**
 * The app's single toast host, positioned per route.
 *
 * On a game route toasts move to the **bottom**, above the composer. Top-centre
 * would put them over `GameHeader`, which carries the two things a player reads
 * mid-run -- the theme and the running score -- so a progress cue or a lost-word
 * error would mask exactly the state it is commenting on.
 *
 * The pathname must be locale-stripped, hence `@/navigation` rather than the raw
 * hook from `next/navigation`: routing is `localePrefix: 'as-needed'`, so the raw
 * hook yields `/he/daily` and a prefix check fails for every non-default locale.
 * `isImmersiveGameRoute` also covers `/daily`, which the old inline
 * `startsWith('/game/')` check missed entirely -- that is why the daily game's
 * cues were landing on the header.
 */
export function DynamicToaster() {
    const pathname = usePathname();
    const isGamePage = isImmersiveGameRoute(pathname);

    return (
        <Toaster
            position={isGamePage ? "bottom-center" : "top-center"}
            closeButton
            toastOptions={{
                style: isGamePage ? { marginBottom: GAME_INPUT_CLEARANCE } : undefined
            }}
        />
    );
}
