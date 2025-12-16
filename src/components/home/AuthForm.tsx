'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, User, Mail, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthProvider';

export default function AuthForm() {
    const [loadingMethod, setLoadingMethod] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [guestUsername, setGuestUsername] = useState('');
    const [email, setEmail] = useState('');
    const searchParams = useSearchParams();
    const router = useRouter();
    const { refreshProfile } = useAuth();

    // Construct the callback URL
    const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL || '';
    const next = searchParams.get('next');
    let callbackUrl = `${origin}/auth/callback`;
    if (next) {
        callbackUrl += `?next=${encodeURIComponent(next)}`;
    }

    const handleGoogleLogin = async () => {
        setLoadingMethod('google');
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: callbackUrl
            }
        });
        // OAuth will redirect, so no need to stop loading really, but just in case
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingMethod('email');
        setMessage('');

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: callbackUrl,
            },
        });

        if (error) {
            setMessage(error.message);
        } else {
            setMessage('Check your email for the login link!');
            setMessage('Check your email for the login link!');
        }
        setLoadingMethod(null);
    };

    const handleGuestLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!guestUsername.trim()) return;

        setLoadingMethod('guest');
        setMessage('');

        try {
            // 1. Sign in anonymously
            const { data: authData, error: authError } = await supabase.auth.signInAnonymously({
                options: {
                    data: {
                        username: guestUsername.trim()
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Failed to create guest session");

            // 2. Create profile for guest
            // We use upsert to be safe, though it should be a new user
            const { error: profileError } = await supabase.from('profiles').upsert({
                id: authData.user.id,
                username: guestUsername.trim(),
                // avatar_url: null // Let it be null so we use initials fallback
            });

            if (profileError) {
                // If profile creation fails, we might want to sign out the user to clean up
                console.error("Profile creation failed:", profileError);
                // But typically we can just let them in, maybe retry later? 
                // For now, let's treat it as an error
                throw profileError;
            }

            // Success - refresh profile to ensure the app knows who we are
            await refreshProfile();

            if (next) {
                router.push(next);
            }

            // AuthProvider should detect the session change and we should be good to go
        } catch (err: any) {
            console.error("Guest login error:", err);
            setMessage(err.message || "Failed to sign in as guest.");
            setLoadingMethod(null); // Only set loading false on error, otherwise we want to show loading until redirect/reload
            // If it's the "Anonymous sign-ins are disabled" error, we should probably tell the user.
            if (err.message && err.message.includes("Anonymous")) {
                setMessage("Guest mode is currently disabled by the administrator.");
            }
        }
    };

    return (
        <div className="w-full max-w-md mx-auto space-y-6">
            <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Account Access</TabsTrigger>
                    <TabsTrigger value="guest">Guest Mode</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-4 py-4">
                    <Button
                        onClick={handleGoogleLogin}
                        variant="outline"
                        className="w-full py-6 flex items-center gap-2 text-base"
                        disabled={loadingMethod !== null}
                    >
                        {loadingMethod === 'google' ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                        )}
                        Sign in with Google
                    </Button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">
                                Or continue with email
                            </span>
                        </div>
                    </div>

                    <form onSubmit={handleEmailLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loadingMethod !== null}
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={loadingMethod !== null}>
                            {loadingMethod === 'email' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                            Send Magic Link
                        </Button>
                    </form>
                </TabsContent>

                <TabsContent value="guest" className="space-y-4 py-4">
                    <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground mb-4">
                        <p>Guest accounts are temporary. Sign up to save your stats and progress.</p>
                    </div>

                    <form onSubmit={handleGuestLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Choose a Username</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="CoolCat99"
                                value={guestUsername}
                                onChange={(e) => setGuestUsername(e.target.value)}
                                required
                                minLength={3}
                                maxLength={20}
                                disabled={loadingMethod !== null}
                            />
                        </div>
                        <Button type="submit" variant="secondary" className="w-full" disabled={loadingMethod !== null || !guestUsername.trim()}>
                            {loadingMethod === 'guest' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <User className="mr-2 h-4 w-4" />}
                            Play as Guest
                        </Button>
                    </form>
                </TabsContent>
            </Tabs>

            {message && (
                <div className="p-3 rounded bg-muted text-sm text-center animate-in fade-in slide-in-from-bottom-2">
                    {message}
                </div>
            )}
        </div>
    );
}
