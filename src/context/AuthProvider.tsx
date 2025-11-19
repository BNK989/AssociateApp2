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
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    profile: null,
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

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

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, profile, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}
