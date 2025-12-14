'use server';

import { createAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';

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
                console.error('Error deleting guest user:', error);
                throw error;
            }
        } catch (err) {
            console.error('Failed to delete guest account:', err);
            // We don't want to block the logout process even if deletion fails
        }
    }
}
