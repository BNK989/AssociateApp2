import { useMemo } from 'react';
import type { Message } from '@/hooks/useGameLogic';
import { summarizeChain } from '@/lib/daily/dailyShare';
import { resolveChainOutcome, type ChainOutcome } from '@/lib/daily/endOutcome';
import type { ShareSquare } from '@/lib/daily/dailyShare';

/**
 * The day's result, read straight off the board.
 *
 * Shared by the end screen and the share text so the headline, the squares on
 * the summary and the squares the player pastes elsewhere are all the same
 * reading of the same chain.
 */
export function useDailyOutcome(messages: Message[]): { squares: ShareSquare[]; outcome: ChainOutcome } {
    return useMemo(() => {
        const squares = summarizeChain(messages);
        return { squares, outcome: resolveChainOutcome(squares) };
    }, [messages]);
}
