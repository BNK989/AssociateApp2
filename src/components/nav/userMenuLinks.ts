import { Settings, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type UserMenuLink = {
    /** Locale-relative route; `@/navigation`'s Link adds the locale prefix. */
    href: string;
    /** Key under the `NavBar` message namespace. */
    labelKey: string;
    icon: LucideIcon;
};

/**
 * The navigable entries of the avatar dropdown, in order.
 *
 * The admin panel is deliberately unlinked everywhere else — `/admin` answers a
 * non-admin with `notFound()` (`src/app/[locale]/admin/layout.tsx`) so that its
 * existence stays hidden. That left typing the URL as the only way in, which is
 * workable on a desktop and painful on a phone, so the avatar menu carries the
 * entry point for the one audience allowed to see it.
 *
 * Rendering it is *not* the authorisation: the layout re-checks
 * `profiles.is_admin` server-side, and every privileged write goes through
 * `requireAdmin()` (`src/lib/adminAuth.ts`). Showing the link to someone whose
 * profile has not loaded yet would only send them to a 404, hence the caller
 * passing a resolved flag rather than an optimistic one.
 */
export function getUserMenuLinks(isAdmin: boolean): UserMenuLink[] {
    const links: UserMenuLink[] = [
        { href: '/settings', labelKey: 'preferences', icon: Settings },
    ];

    if (isAdmin) {
        links.push({ href: '/admin', labelKey: 'admin_panel', icon: ShieldCheck });
    }

    return links;
}
