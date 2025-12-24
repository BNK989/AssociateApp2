'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { Loader2 } from 'lucide-react';
import { toast } from "sonner";

export default function JoinGamePage() {
    const params = useParams();
    const gameId = params.gameId as string;
    const searchParams = useSearchParams();
    const invitedBy = searchParams.get('invitedBy');

    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [status, setStatus] = useState('Checking credentials...');
    const joiningRef = useRef(false);

    useEffect(() => {
        if (authLoading) return;

        // If not logged in, we stay on this page to show the invite card
        // unless there is no invitedBy param (legacy link), in which case maybe we still show a generic invite?
        // Let's settle on: Always show invite card if not logged in.
        if (!user) {
            setStatus('Waiting for login...');
            return;
        }

        if (joiningRef.current) return;
        joiningRef.current = true;
        joinGame();
    }, [user, authLoading, gameId]);

    const joinGame = async () => {
        if (!user) return;
        setStatus('Joining game...');

        try {
            // Fetch profile for username
            const { data: profile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', user.id)
                .single();

            const username = profile?.username || 'Unknown Player';

            // 1. Check if already a player
            const { data: existingPlayer, error: checkError } = await supabase
                .from('game_players')
                .select('*')
                .eq('game_id', gameId)
                .eq('user_id', user.id)
                .single();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
                console.error("Error checking player status:", checkError);
                throw checkError;
            }

            if (existingPlayer) {
                // Check if they had left, if so, rejoin them (optional, logic might vary)
                if (existingPlayer.has_left) {
                    const { error: rejoinError } = await supabase
                        .from('game_players')
                        .update({ has_left: false })
                        .eq('game_id', gameId)
                        .eq('user_id', user.id);

                    if (rejoinError) throw rejoinError;

                    // Insert Rejoin System Message
                    await supabase.from('messages').insert({
                        game_id: gameId,
                        user_id: user.id,
                        content: `Player ${username} joined the game`,
                        type: 'system',
                        cipher_length: 0,
                        is_solved: true // System messages are "solved" by default implicitly or just visible
                    });

                    toast.success("Welcome back!");
                } else {
                    toast.info("You are already in this game.");
                }
            } else {
                // 2. Add as new player
                const { error: joinError } = await supabase
                    .from('game_players')
                    .insert({
                        game_id: gameId,
                        user_id: user.id,
                        score: 0
                    });

                if (joinError) {
                    // Check for unique violation (code 23505) - means race condition won or user already joined
                    if (joinError.code === '23505') {
                        console.log("Player already joined (race condition handling)");
                        toast.success("Joined game successfully!");
                    } else {
                        throw joinError;
                    }
                } else {
                    // Insert Join System Message
                    await supabase.from('messages').insert({
                        game_id: gameId,
                        user_id: user.id,
                        content: `Player ${username} joined the game`, // Standard format
                        type: 'system',
                        cipher_length: 0,
                        is_solved: true
                    });

                    toast.success("Joined game successfully!");
                }
            }

            // 3. Redirect to game
            router.push(`/game/${gameId}`);

        } catch (error) {
            console.error('Error joining game:', error);
            toast.error("Failed to join game. Please try again.");
            setStatus('Failed to join.');
            // Maybe redirect home after a delay?
            setTimeout(() => router.push('/'), 3000);
        }
    };

    if (authLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
            </div>
        );
    }

    // Unauthenticated State - Show Invitation
    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6">
                    <div className="mx-auto w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-3xl">
                        ✉️
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold">Game Invitation</h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            {invitedBy
                                ? <span>You've been invited to play with <span className="font-semibold text-purple-600 dark:text-purple-400">{invitedBy}</span>!</span>
                                : "You've been invited to join a game of Associate."
                            }
                        </p>
                    </div>

                    <div className="space-y-3 pt-2">
                        <button
                            onClick={() => {
                                const nextUrl = `/join/${gameId}`;
                                router.push(`/?next=${encodeURIComponent(nextUrl)}#auth-form`);
                            }}
                            className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-purple-500/25"
                        >
                            Login to Play
                        </button>

                        <p className="text-xs text-gray-500">
                            Don't have an account? You can play as a guest!
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <div className="text-center space-y-4">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-purple-600" />
                <h1 className="text-xl font-semibold">{status}</h1>
                <p className="text-sm text-gray-500">Please wait while we connect you to the game...</p>
            </div>
        </div>
    );
}
