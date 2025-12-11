import { useAuth } from '@/context/AuthProvider';

export function useAdmin() {
    const { profile, loading } = useAuth();

    // Default to false while loading or if profile/is_admin is missing
    const isAdmin = !!(profile?.is_admin);

    return {
        isAdmin,
        loading
    };
}
