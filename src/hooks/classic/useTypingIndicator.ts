import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { GAME_CONFIG } from '@/lib/gameConfig';

/** How long a player is shown as typing after their last keystroke. */
const TYPING_TIMEOUT_MS = 3000;

type Channel = ReturnType<typeof supabase.channel>;

/**
 * Who is currently typing, driven by channel broadcasts rather than the
 * database — typing is transient and not worth a row.
 *
 * Each player's indicator expires on its own timer, so a client that drops off
 * mid-word does not leave a permanent "typing…" behind.
 */
export function useTypingIndicator(user: User | null, channelRef: React.RefObject<Channel | null>) {
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const timeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

    const clearFor = useCallback((userId: string) => {
        const timeout = timeouts.current.get(userId);
        if (timeout) clearTimeout(timeout);
        timeouts.current.delete(userId);
    }, []);

    /** Marks a player as typing, refreshing their expiry. */
    const markTyping = useCallback((userId: string) => {
        if (!GAME_CONFIG.ENABLE_TYPING_INDICATORS) return;
        if (userId === user?.id) return;

        setTypingUsers((prev) => new Set(prev).add(userId));
        clearFor(userId);

        timeouts.current.set(userId, setTimeout(() => {
            setTypingUsers((prev) => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
            timeouts.current.delete(userId);
        }, TYPING_TIMEOUT_MS));
    }, [user?.id, clearFor]);

    /** Clears immediately — their word has arrived, so they are done typing. */
    const stopTyping = useCallback((userId: string) => {
        setTypingUsers((prev) => {
            if (!prev.has(userId)) return prev;
            const next = new Set(prev);
            next.delete(userId);
            return next;
        });
        clearFor(userId);
    }, [clearFor]);

    const broadcastTyping = useCallback(() => {
        if (!GAME_CONFIG.ENABLE_TYPING_INDICATORS || !channelRef.current || !user) return;

        channelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: { user_id: user.id },
        });
    }, [user, channelRef]);

    useEffect(() => {
        const pending = timeouts.current;
        return () => {
            pending.forEach(clearTimeout);
            pending.clear();
        };
    }, []);

    return { typingUsers, markTyping, stopTyping, broadcastTyping };
}
