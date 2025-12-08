import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { toast } from "sonner";

export function useTurnNotifications(isMyTurn: boolean) {
    const { profile } = useAuth();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const titleIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const originalTitleRef = useRef<string>('');
    const prevTurnRef = useRef<boolean>(false);

    // Initialize Audio
    useEffect(() => {
        if (typeof window !== 'undefined') {
            audioRef.current = new Audio('/sounds/notifications/chime1.mp3');
        }

        // Unlock audio on first user interaction
        const unlockAudio = () => {
            if (audioRef.current) {
                audioRef.current.play().then(() => {
                    audioRef.current?.pause();
                    audioRef.current!.currentTime = 0;
                }).catch(() => {
                    // Ignore error if it fails (still no interaction?)
                });
            }
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };

        window.addEventListener('click', unlockAudio);
        window.addEventListener('keydown', unlockAudio);
        window.addEventListener('touchstart', unlockAudio);

        return () => {
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };
    }, []);

    // Initialize prevTurnRef on first render to avoid chime on page load
    const initialized = useRef(false);
    useEffect(() => {
        if (!initialized.current) {
            prevTurnRef.current = isMyTurn;
            initialized.current = true;
        }
    }, [isMyTurn]);

    // Handle Title Flash Logic
    const startTitleFlash = useCallback(() => {
        if (!originalTitleRef.current) originalTitleRef.current = document.title;
        let isOriginal = true;

        if (titleIntervalRef.current) clearInterval(titleIntervalRef.current);

        titleIntervalRef.current = setInterval(() => {
            document.title = isOriginal ? "🔔 Your Turn - Associate Game" : originalTitleRef.current;
            isOriginal = !isOriginal;
        }, 1000);
    }, []);

    const stopTitleFlash = useCallback(() => {
        if (titleIntervalRef.current) {
            clearInterval(titleIntervalRef.current);
            titleIntervalRef.current = null;
        }
        if (originalTitleRef.current) {
            document.title = originalTitleRef.current;
        }
    }, []);

    // Handle Turn Change
    useEffect(() => {
        // Trigger only when turn changes to TRUE
        if (isMyTurn && !prevTurnRef.current) {
            console.log("Turn Notification Triggered!");

            // 1. Audio Chime
            if (profile?.settings?.enable_audio_chime !== false) { // Default true
                audioRef.current?.play().catch(err => console.error("Audio play failed:", err));
            }

            // 2. System Notification
            if (profile?.settings?.enable_system_notifications !== false) { // Default true
                if (Notification.permission === 'granted' && document.hidden) {
                    new Notification("It's your turn!", {
                        body: "Someone finished their turn. You're up!",
                        icon: '/favicon.ico' // Ensure valid path or use default
                    });
                }
            }

            // 3. Title Flash (Only if tab is hidden)
            if (profile?.settings?.enable_title_flash !== false) { // Default true
                if (document.hidden) {
                    startTitleFlash();
                }
            }
        }

        // Stop flash if turn ends or tab becomes visible
        if (!isMyTurn || !document.hidden) {
            stopTitleFlash();
        }

        prevTurnRef.current = isMyTurn;
    }, [isMyTurn, profile, startTitleFlash, stopTitleFlash]);

    // Handle Visibility Change to stop flash
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                stopTitleFlash();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            stopTitleFlash(); // Cleanup on unmount
        };
    }, [stopTitleFlash]);
}
