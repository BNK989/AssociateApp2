'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, Subscription } from '@supabase/supabase-js';
import type { Profile } from '@/types/app';
import { supabase } from '@/lib/supabase';
import { useTheme } from 'next-themes';



type AuthContextType = {
    user: User | null;
    session: Session | null;
    loading: boolean;
    profile: Profile | null;
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

export default function AuthProvider({ children, initialSession = null }: { children: React.ReactNode; initialSession?: Session | null }) {
    const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
    const [session, setSession] = useState<Session | null>(initialSession);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(!initialSession);
    const { setTheme } = useTheme();
    const [lastSyncedTheme, setLastSyncedTheme] = useState<string | null>(null);

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
        let subscription: Subscription | null = null;

        const init = async () => {
             // If we have an initial session, ensure we fetch the profile if needed
             // checking if profile needs to be fetched is handled by the effect dependencies ideally,
             // but here we just want to ensure subscription is set up.
            
            // Note: If initialSession provided, loading starts as false. 
            // We still need to set up the listener.

            try {
                // Only fetch session if we didn't provide one initially or want to verify
                // But typically for SPA, we trust the initial prop for first render.
                // However, supabase.auth.getSession() essentially returns the local session.
                
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                
                if (!mounted) return;

                // If no initial session was passed, or if the local session differs, update.
                // Use a simple check or just rely on the listener.
                // But we must handle the 'loading' state if we started true.

                if (!initialSession && !currentSession) {
                     setLoading(false);
                }

                if (initialSession && !profile) {
                     // We have session but no profile yet (since profile is client-fetch for now)
                     if (initialSession.user) {
                         fetchProfile(initialSession.user.id).catch(console.error);
                     }
                }

                // Subscribe to changes
                const { data } = supabase.auth.onAuthStateChange(async (event, newSession) => {
                    if (!mounted) return;
                    
                    setSession(newSession);
                    setUser(newSession?.user ?? null);

                    if (newSession?.user) {
                        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || (event === 'INITIAL_SESSION' && !profile)) {
                            fetchProfile(newSession.user.id).catch(console.error);
                        }
                    } else {
                        setProfile(null);
                        setLastSyncedTheme(null);
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

    // Sync theme from profile settings if available
    useEffect(() => {
        if (profile?.settings?.theme && profile.settings.theme !== lastSyncedTheme) {
            setTheme(profile.settings.theme);
            setLastSyncedTheme(profile.settings.theme);
        }
    }, [profile, setTheme, lastSyncedTheme]);

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
