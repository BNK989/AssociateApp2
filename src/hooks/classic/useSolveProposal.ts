import { useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';
import type { GameState } from './types';

const log = createLogger('game');

type UseSolveProposalArgs = {
    game: GameState | null;
    user: User | null;
    markAction: () => void;
    refetch: () => void;
};

/**
 * The vote to switch a game from texting into solving.
 *
 * Any player may propose; everyone still in the game must agree, or the
 * proposal timer lapses and it happens anyway.
 */
export function useSolveProposal({ game, user, markAction, refetch }: UseSolveProposalArgs) {
    const post = useCallback(async (action: string, operation: string) => {
        if (!game) return;
        markAction();

        try {
            await fetch(`/api/game/${game.id}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            refetch();
        } catch (error) {
            log.error(operation, `Failed to ${operation.replace('_', ' ')}`, {
                game_id: game.id, user_id: user?.id,
            }, error);
        }
    }, [game, user?.id, markAction, refetch]);

    const proposeSolvingMode = useCallback(async () => {
        if (!user) return;
        await post('propose_solve', 'propose_solve');
    }, [user, post]);

    const denySolvingMode = useCallback(async () => {
        await post('deny_solve', 'deny_solve');
    }, [post]);

    const confirmSolvingMode = useCallback(async () => {
        if (!user) return;
        // Confirming twice is a no-op server-side, but skip the round trip.
        if (game?.solve_proposal_confirmations?.includes(user.id)) return;
        await post('confirm_solve', 'confirm_solve');
    }, [user, game?.solve_proposal_confirmations, post]);

    return { proposeSolvingMode, denySolvingMode, confirmSolvingMode };
}
