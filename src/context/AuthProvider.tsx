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
    }, []);

    useEffect(() => {
        const initializeAuth = async () => {
            // 1. Get initial session
            const { data: { session: initialSession } } = await supabase.auth.getSession();
            setSession(initialSession);
            setUser(initialSession?.user ?? null);

            if (initialSession?.user) {
                await fetchProfile(initialSession.user.id);
            }
            setLoading(false);

            // 2. Listen for changes
            const { data: { subscription } } = supabase.auth.onAuthStateChange(
                async (event, currentSession) => {
                    setSession(currentSession);
                    setUser(currentSession?.user ?? null);

                    if (currentSession?.user && event !== 'INITIAL_SESSION') {
                        // Only fetch profile if user changed or signed in (avoid double fetch on init)
                        await fetchProfile(currentSession.user.id);
                    } else if (!currentSession?.user) {
                        setProfile(null);
                    }

                    setLoading(false);
                }
            );

            return () => {
                subscription.unsubscribe();
            };
        };

        initializeAuth();
    }, []);

    // Apply theme based on profile settings or system preference
    useEffect(() => {
        const applyTheme = () => {
            const userTheme = profile?.settings?.theme;
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
