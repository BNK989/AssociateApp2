import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server-only. Used by admin API routes to gate privileged writes.

export type AdminCheck =
    | { ok: true; userId: string }
    | { ok: false; status: 401 | 403; reason: string };

/**
 * Confirms the caller is a signed-in admin.
 *
 * Admin API routes need this because `profiles.is_admin` is the only thing
 * separating an ordinary player from someone who can rewrite the game's rules —
 * the service-role client used for the actual write bypasses RLS entirely, so
 * this check *is* the authorisation.
 *
 * `src/app/[locale]/admin/layout.tsx` performs the same check for pages, but
 * answers a failure with `notFound()` to hide that the admin area exists. A
 * route returns a status instead, since the caller is already inside the panel.
 */
export async function requireAdmin(): Promise<AdminCheck> {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options));
                    } catch { /* called from a Server Component; the session is still readable */ }
                },
            },
        },
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { ok: false, status: 401, reason: 'Not signed in' };

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

    if (error || !profile?.is_admin) {
        return { ok: false, status: 403, reason: 'Not an admin' };
    }

    return { ok: true, userId: user.id };
}
