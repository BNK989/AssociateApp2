import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { createLogger } from '@/lib/logger';
import { getRemainingSeconds, PROPOSAL_TIMEOUT_MS } from '@/lib/classicGame/classicRules';
import type { GameState } from './types';

const log = createLogger('game');

const TICK_MS = 1000;
const SOLVING_WINDOW_MS = GAME_CONFIG.SOLVING_MODE_DURATION_SECONDS * 1000;

/**
 * The two countdowns a classic game runs.
 *
 * The *proposal* timer closes an open vote to switch into solving: when it
 * expires the game switches anyway, so one silent player cannot stall it.
 * The *solving* timer is the author's exclusive window on the current word;
 * at zero the word becomes free-for-all.
 */
export function useGameTimers(game: GameState | null) {
    const [proposalTimeLeft, setProposalTimeLeft] = useState<number | null>(null);
    const [solvingTimeLeft, setSolvingTimeLeft] = useState<number | null>(null);

    const proposalCreatedAt = game?.solving_proposal_created_at;
    const solvingStartedAt = game?.solving_started_at;
    const status = game?.status;
    const gameId = game?.id;

    const finalizeSolvingMode = useCallback(async () => {
        if (!gameId) return;

        const { error } = await supabase
            .from('games')
            .update({
                status: 'solving',
                solving_proposal_created_at: null,
                solving_started_at: new Date().toISOString(),
            })
            .eq('id', gameId);

        if (error) {
            log.error('finalize_mode', 'Failed to switch game into solving mode', { game_id: gameId }, error);
        }
    }, [gameId]);

    useEffect(() => {
        if (!proposalCreatedAt) {
            setProposalTimeLeft(null);
            return;
        }

        const tick = () => {
            const remaining = getRemainingSeconds(proposalCreatedAt, PROPOSAL_TIMEOUT_MS);
            setProposalTimeLeft(remaining);

            if (remaining === 0) {
                clearInterval(interval);
                // The vote lapsed rather than failed, so proceed.
                if (status !== 'solving') finalizeSolvingMode();
            }
        };

        const interval = setInterval(tick, TICK_MS);
        return () => clearInterval(interval);
    }, [proposalCreatedAt, status, finalizeSolvingMode]);

    useEffect(() => {
        if (status !== 'solving' || !solvingStartedAt) {
            setSolvingTimeLeft(null);
            return;
        }

        const tick = () => {
            const remaining = getRemainingSeconds(solvingStartedAt, SOLVING_WINDOW_MS);
            setSolvingTimeLeft(remaining);
            if (remaining === 0) clearInterval(interval);
        };

        const interval = setInterval(tick, TICK_MS);
        return () => clearInterval(interval);
    }, [status, solvingStartedAt]);

    return { proposalTimeLeft, solvingTimeLeft };
}
