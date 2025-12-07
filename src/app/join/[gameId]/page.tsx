'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { Loader2 } from 'lucide-react';
import { toast } from "sonner";

export default function JoinGamePage() {
    const params = useParams();
    const gameId = params.gameId as string;
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [status, setStatus] = useState('Checking credentials...');
    const joiningRef = useRef(false);

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            // Store the return URL and redirect to login (which is at root /)
            const nextUrl = `/join/${gameId}`;
            // Redirect to root with next param
            router.push(`/?next=${encodeURIComponent(nextUrl)}`);
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
