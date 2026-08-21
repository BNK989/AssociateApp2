'use server';

import { createAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth/actions');

export async function deleteGuestAccount() {
    // Create a standard server client to get the current session/user securely
    // We must await it because cookies() is async
    const supabase = await createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    // Only delete if it's an anonymous user
    if (user.is_anonymous) {
        try {
            const adminClient = createAdminClient();
            const { error } = await adminClient.auth.admin.deleteUser(user.id);

            if (error) {
                log.error('delete_guest', 'Failed to delete guest user', { user_id: user.id }, error);
                throw error;
            }
        } catch (err) {
            log.error('delete_guest', 'Unexpected error deleting guest account', undefined, err);
            // We don't want to block the logout process even if deletion fails
        }
    }
}

export async function clearAuthCookies() {
    try {
        const supabase = await createSupabaseServerClient();
        await supabase.auth.signOut();
    } catch (e) {
        log.error('clear_cookies', 'Failed to clear auth cookies', undefined, e);
    }
}
