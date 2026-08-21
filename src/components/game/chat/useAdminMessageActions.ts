import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { createLogger, getErrorMessage } from '@/lib/logger';
import type { GameState } from '@/hooks/useGameLogic';

const log = createLogger('game/chat');

/**
 * Admin-only message actions available from the chat context menu, plus the
 * per-message "revealed" overrides those actions toggle.
 */
export function useAdminMessageActions(game: GameState, user: User | null) {
    const [revealedMessages, setRevealedMessages] = useState<Record<string, boolean>>({});

    const handleAdminAction = useCallback(async (action: string, messageId: string) => {
        try {
            if (action === 'delete') {
                if (!confirm('Delete this message?')) return;
                const { error } = await supabase.from('messages').delete().eq('id', messageId);
                if (error) throw error;
                toast.success('Message deleted');
                return;
            }

            if (action === 'show_content') {
                setRevealedMessages((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
                return;
            }

            if (action.startsWith('hint_')) {
                const hintType = action.replace('hint_', ''); // '1', '2', or '3'
                const response = await fetch(`/api/game/${game.id}/action`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'hint', hintType, userId: user?.id }),
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to trigger hint');
                }
                toast.success(`Hint ${hintType} triggered`);
            }
        } catch (error: unknown) {
            log.error('admin_action', 'Admin action failed', { game_id: game?.id, action }, error);
            toast.error(`Action failed: ${getErrorMessage(error)}`);
        }
    }, [game.id, game, user?.id]);

    return { revealedMessages, setRevealedMessages, handleAdminAction };
}
