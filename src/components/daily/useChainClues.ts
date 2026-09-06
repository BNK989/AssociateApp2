import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { Message } from '@/hooks/useGameLogic';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { buildInitialMessages } from '@/lib/daily/dailyMessages';
import type { DailyHintPolicy } from '@/lib/daily/hintPolicy';

type UseChainCluesArgs = {
    words: string[];
    policy: DailyHintPolicy;
    hints?: string[] | null;
    connectionScores?: number[] | null;
};

/**
 * How a day's chain is built and how each word's clue is chosen.
 *
 * Split out of the game hook because it is the one part with no state of its
 * own: given the day's words and the policy in force it is a pure description
 * of the board, used both to open a fresh chain and to top up a restored one.
 */
export function useChainClues({ words, policy, hints, connectionScores }: UseChainCluesArgs) {
    const t = useTranslations('GameRoom.Chat');

    const fallbackHint = useCallback((word: string) => t('hint_fallback', {
        length: word.length,
        firstLetter: word[0].toUpperCase(),
    }), [t]);

    const freshMessages = useCallback((): Message[] => buildInitialMessages({
        words,
        policy,
        hints,
        connectionScores,
        fallbackHint,
        animateStartWord: GAME_CONFIG.DAILY_GAME_ANIMATE_START_MESSAGE,
    }), [words, policy, hints, connectionScores, fallbackHint]);

    /** Clue for a word, preferring the day's authored hint over the generic one. */
    const resolveClue = useCallback(
        (index: number, word: string) => hints?.[index] ?? fallbackHint(word),
        [hints, fallbackHint],
    );

    return { fallbackHint, freshMessages, resolveClue };
}
