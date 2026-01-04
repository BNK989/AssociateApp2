'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';



type AuthContextType = {
    user: User | null;
    session: Session | null;
    loading: boolean;
    profile: any | null;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    profile: null,
    signOut: async () => { },
    refreshProfile: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    // Proactive session check on tab resume
    // Proactive session check on tab resume
    useEffect(() => {
        if (loading) return; // Don't check visibility if still loading

        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                const { data, error } = await supabase.auth.getUser();
                if (error) {
                    console.log("Session invalid on resume, attempting refresh...");
                    await supabase.auth.refreshSession();
                } else {
                    console.log("Session verified on resume.");
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [loading]);



    // Effect for cleanup needs to be cleaner.
    // Let's restructure to match React best practices for async effects.
    useEffect(() => {
        let mounted = true;
        let subscription: any = null;

        const init = async () => {
            const timeoutId = setTimeout(() => {
                if (mounted) {
                    console.warn("Auth initialization timed out - forcing app load");
                    setLoading(false);
                }
            }, 2000);

            try {
                const { data: { session: initialSession } } = await supabase.auth.getSession();
                clearTimeout(timeoutId);

                if (!mounted) return;

                setSession(initialSession);
                setUser(initialSession?.user ?? null);

                if (initialSession?.user) {
                    fetchProfile(initialSession.user.id).catch(console.error);
                }

                setLoading(false);

                const { data } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
                    if (!mounted) return;
                    setSession(currentSession);
                    setUser(currentSession?.user ?? null);

                    if (currentSession?.user) {
                        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                            fetchProfile(currentSession.user.id).catch(console.error);
                        }
                    } else {
                        setProfile(null);
                    }
                    setLoading(false);
                });
                subscription = data.subscription;

            } catch (e) {
                console.error("Auth init failed", e);
                if (mounted) setLoading(false);
            }
        };

        init();

        return () => {
            mounted = false;
            if (subscription) subscription.unsubscribe();
        };
    }, []);

    // Apply theme based on profile settings or system preference
    useEffect(() => {
        if (!profile) return; // Wait for profile for theme, or default to system handled by ThemeProvider
        const applyTheme = () => {
            const userTheme = profile?.settings?.theme;
            // ThemeProvider handles system default, we only override if user has preference
            // Actually, we should probably integrate with next-themes useTheme hook instead of manual class manipulation
            // But preserving existing logic for now.
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const shouldBeDark = userTheme === 'dark' || (!userTheme && systemDark);

            if (shouldBeDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        };

        applyTheme();
    }, [profile]);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
            } else {
                setProfile(data);
            }
        } catch (err) {
            console.error('Unexpected error fetching profile:', err);
        }
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, profile, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
}
