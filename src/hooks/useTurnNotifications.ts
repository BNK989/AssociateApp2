import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { toast } from "sonner";

export function useTurnNotifications(isMyTurn: boolean, isMyMessageBeingGuessed: boolean = false) {
    const { profile } = useAuth();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const titleIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const originalTitleRef = useRef<string>('');
    const prevTurnRef = useRef<boolean>(false);
    const prevMessageGuessedRef = useRef<boolean>(false);
    const hasRequestedPermission = useRef<boolean>(false);

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

    // Request Notification Permission
    useEffect(() => {
        // Only ask if default (not denied or granted) and haven't asked this session
        if (
            typeof Notification !== 'undefined' &&
            Notification.permission === 'default' &&
            !hasRequestedPermission.current
        ) {
            hasRequestedPermission.current = true;
            toast("Enable Notifications?", {
                description: "Get notified when it's your turn even if you're away.",
                // Fix: Ensure text is readable in light mode (often descriptions are too light)
                descriptionClassName: "!text-zinc-800 dark:!text-zinc-400 font-medium",
                action: {
                    label: "Enable",
                    onClick: () => {
                        Notification.requestPermission().then((permission) => {
                            if (permission === 'granted') {
                                toast.success("Notifications enabled!");
                            }
                        });
                    }
                },
                duration: 10000,
            });
        }
    }, []);


    // Initialize refs on first render
    const initialized = useRef(false);
    useEffect(() => {
        if (!initialized.current) {
            prevTurnRef.current = isMyTurn;
            prevMessageGuessedRef.current = isMyMessageBeingGuessed;
            initialized.current = true;
        }
    }, [isMyTurn, isMyMessageBeingGuessed]);

    // Handle Title Flash Logic
    const startTitleFlash = useCallback((message = "🔔 Action Needed!") => {
        if (!originalTitleRef.current) originalTitleRef.current = document.title;
        let isOriginal = true;

        if (titleIntervalRef.current) clearInterval(titleIntervalRef.current);

        titleIntervalRef.current = setInterval(() => {
            document.title = isOriginal ? message : originalTitleRef.current;
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

    // Common Notification Trigger
    const triggerNotification = useCallback((type: 'turn' | 'guess') => {
        const title = type === 'turn' ? "It's your turn!" : "Your message is up!";
        const body = type === 'turn'
            ? "Someone finished their turn. You're up!"
            : "Players are trying to guess your message now!";

        console.log(`${type} Notification Triggered!`);

        // 1. Audio Chime
        if (profile?.settings?.enable_audio_chime !== false) {
            audioRef.current?.play().catch(err => console.error("Audio play failed:", err));
        }

        // 2. System Notification
        if (document.hidden && profile?.settings?.enable_system_notifications !== false) {
            if (Notification.permission === 'granted') {
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.ready.then(registration => {
                        registration.showNotification(title, {
                            body: body,
                            icon: '/icon-192x192.png',
                            badge: '/icon-192x192.png',
                            tag: 'game-notification',
                            data: { url: window.location.href }
                        });
                    });
                } else {
                    const n = new Notification(title, {
                        body: body,
                        icon: '/icon-192x192.png'
                    });
                    n.onclick = () => {
                        window.focus();
                        n.close();
                    };
                }
            }
        }

        // 3. Title Flash
        if (profile?.settings?.enable_title_flash !== false) {
            if (document.hidden) {
                startTitleFlash(type === 'turn' ? "🔔 Your Turn!" : "🔔 Your Message!");
            }
        }
    }, [profile, startTitleFlash]);


    // Watch for Turn Change
    useEffect(() => {
        if (isMyTurn && !prevTurnRef.current) {
            triggerNotification('turn');
        }

        // Stop flash if resolved/visible (simple check)
        if (!isMyTurn && !isMyMessageBeingGuessed && !document.hidden) {
            stopTitleFlash();
        }

        prevTurnRef.current = isMyTurn;
    }, [isMyTurn, isMyMessageBeingGuessed, triggerNotification, stopTitleFlash]);

    // Watch for My Message Being Guessed
    useEffect(() => {
        if (isMyMessageBeingGuessed && !prevMessageGuessedRef.current) {
            triggerNotification('guess');
        }

        prevMessageGuessedRef.current = isMyMessageBeingGuessed;
    }, [isMyMessageBeingGuessed, triggerNotification]);


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
            stopTitleFlash();
        };
    }, [stopTitleFlash]);
}
