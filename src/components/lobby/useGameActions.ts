import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('lobby');

type UseGameActionsArgs = {
    user: User | null;
    /** Drops a game from both lists so the card disappears immediately. */
    removeGame: (gameId: string) => void;
};

/**
 * Per-game actions offered from a lobby card.
 *
 * Leaving goes through the API rather than a direct write, because it also has
 * to post a system message and rotate the turn if it was the leaver's. Archiving
 * is per-player — it only sets a flag on their own `game_players` row and leaves
 * everyone else's lobby untouched. Delete and reset are admin-only.
 */
export function useGameActions({ user, removeGame }: UseGameActionsArgs) {
    const t = useTranslations('Lobby');
    const [gameToLeave, setGameToLeave] = useState<string | null>(null);
    const [leaving, setLeaving] = useState(false);

    const confirmLeave = useCallback(async () => {
        if (!gameToLeave || !user) return;
        setLeaving(true);

        try {
            const response = await fetch(`/api/game/${gameToLeave}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'leave_game' }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to leave game');
            }

            removeGame(gameToLeave);
            toast.success(t('toasts.left_success'));
            setGameToLeave(null);
        } catch (error) {
            log.error('leave_game', 'Failed to leave game', { game_id: gameToLeave, user_id: user.id }, error);
            toast.error(t('toasts.left_error'));
        } finally {
            setLeaving(false);
        }
    }, [gameToLeave, user, removeGame, t]);

    const archiveGame = useCallback(async (gameId: string) => {
        const { error } = await supabase
            .from('game_players')
            .update({ is_archived: true })
            .eq('game_id', gameId)
            .eq('user_id', user?.id);

        if (error) {
            log.error('archive_game', 'Failed to archive game', { game_id: gameId, user_id: user?.id }, error);
            toast.error(t('toasts.archived_error'));
            return;
        }

        removeGame(gameId);
    }, [user?.id, removeGame, t]);

    const deleteGame = useCallback(async (gameId: string) => {
        if (!confirm('Are you sure you want to delete this game? This cannot be undone.')) return;

        const { error } = await supabase.from('games').delete().eq('id', gameId);

        if (error) {
            log.error('delete_game', 'Failed to delete game', { game_id: gameId, user_id: user?.id }, error);
            toast.error(t('toasts.deleted_error'));
            return;
        }

        toast.success(t('toasts.deleted_success'));
        removeGame(gameId);
    }, [user?.id, removeGame, t]);

    const resetGame = useCallback(async (gameId: string) => {
        if (!confirm('Are you sure you want to RESET this game? This will clear all scores and return to texting mode.')) return;

        try {
            await fetch(`/api/game/${gameId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset_game' }),
            });
            toast.success(t('toasts.reset_success'));
        } catch (error) {
            log.error('reset_game', 'Failed to reset game', { game_id: gameId, user_id: user?.id }, error);
            toast.error(t('toasts.reset_error'));
        }
    }, [user?.id, t]);

    return {
        gameToLeave,
        setGameToLeave,
        leaving,
        confirmLeave,
        archiveGame,
        deleteGame,
        resetGame,
    };
}
