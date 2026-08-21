import { useTranslations } from 'next-intl';
import type { GameState } from '@/hooks/useGameLogic';
import type { TurnState } from './inputRules';

type UsePlaceholderArgs = {
    game: GameState;
    turn: TurnState;
    solvingTimeLeft: number | null;
    isSinglePlayer: boolean;
};

/**
 * Prompt text for the input, which has to say something different for each
 * combination of phase, whose turn it is, and whether the word has opened up.
 *
 * While solving, the message tells the player either that the word is theirs
 * to answer, that they are waiting on someone (with the countdown), or that it
 * is now anyone's.
 */
export function usePlaceholder({
    game,
    turn,
    solvingTimeLeft,
    isSinglePlayer,
}: UsePlaceholderArgs): string {
    const t = useTranslations('GameRoom.Input');
    const { isMyTurn, isFreeForAll, targetPlayer, targetPlayerHasLeft } = turn;

    if (game.status !== 'solving') {
        return isMyTurn
            ? t('placeholder_turn_me')
            : t('placeholder_turn_other', {
                user: targetPlayer?.profiles?.username || 'someone else',
            });
    }

    if (isSinglePlayer) return t('placeholder_solving_single');

    const seconds = solvingTimeLeft ?? 0;
    const authorName = targetPlayer?.profiles?.username || 'Author';

    if (isFreeForAll) {
        // Their own word going free-for-all should not happen, but read sensibly if it does.
        if (isMyTurn) return t('placeholder_solving_single');
        return targetPlayerHasLeft
            ? t('placeholder_free')
            : t('placeholder_solving_other', { user: authorName, seconds });
    }

    return isMyTurn
        ? t('placeholder_solving_me', { seconds })
        : t('placeholder_solving_other', { user: authorName, seconds });
}
