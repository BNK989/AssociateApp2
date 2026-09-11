import { useCallback } from 'react';
import type { Message } from '@/hooks/useGameLogic';
import { createLogger } from '@/lib/logger';
import { getNextHintLevel, MAX_HINT_LEVEL } from '@/lib/daily/dailyScoring';
import { hintLevelUpdates } from '@/lib/daily/hintVisuals';
import type { DailyHintPolicy } from '@/lib/daily/hintPolicy';
import type { HintSource } from '@/lib/daily/dailyAnalytics';

const log = createLogger('daily/hint');

type UseDailyHintRevealArgs = {
    targetMessage?: Message;
    gameOver: boolean;
    words: string[];
    hints?: string[] | null;
    policy: DailyHintPolicy;
    date: string;
    /** Clue used when no authored hint exists for the word. */
    fallbackHint: (word: string) => string;
    patchTarget: (id: string, updates: Partial<Message>) => void;
    /** Position of a word in the chain, which is how every event indexes it. */
    indexOfMessage: (id: string) => number;
    /**
     * Announces a landed hint, with the rung it actually reached.
     *
     * `toLevel` is not `currentLevel + 1`: the ladder skips rungs that would
     * tell the player nothing, so a reported level the caller inferred would be
     * wrong exactly on the words where the skip matters.
     */
    onRevealed?: (args: { message: Message; index: number; toLevel: number; source: HintSource }) => void;
};

/**
 * Advances the current word's hint level, generating the cipher and clue to
 * match.
 *
 * Which level the player lands on is the ladder's decision — under a `jump`
 * progression it goes straight to the AI clue, and the ladder skips rungs that
 * would tell the player nothing they already know.
 *
 * Authored hints are preferred; a fetch is only attempted when the day's hints
 * were not preloaded, since that endpoint is rate limited.
 */
export function useDailyHintReveal({
    targetMessage,
    gameOver,
    words,
    hints,
    policy,
    date,
    fallbackHint,
    patchTarget,
    indexOfMessage,
    onRevealed,
}: UseDailyHintRevealArgs) {
    return useCallback(async (
        fetchHint?: (index: number) => Promise<string | null>,
        source: HintSource = 'manual',
    ) => {
        if (!targetMessage || gameOver) return;

        const currentLevel = targetMessage.hint_level || 0;
        if (currentLevel >= MAX_HINT_LEVEL) return;

        const nextLevel = getNextHintLevel({
            currentLevel,
            word: targetMessage.content,
            guesses: targetMessage.guesses || [],
            progression: policy.progression,
        });

        let clue: string | undefined;

        if (nextLevel === MAX_HINT_LEVEL) {
            const index = words.indexOf(targetMessage.content);
            clue = hints?.[index] ?? fallbackHint(targetMessage.content);

            if (!hints && fetchHint && index !== -1) {
                try {
                    clue = (await fetchHint(index)) ?? clue;
                } catch (e) {
                    log.error('fetch_hint', 'Failed to fetch AI hint', { play_date: date }, e);
                }
            }
        }

        const updates: Partial<Message> = hintLevelUpdates({
            word: targetMessage.content,
            currentLevel,
            nextLevel,
            currentCipher: targetMessage.cipher_text,
            clue,
        });

        patchTarget(targetMessage.id, updates);
        onRevealed?.({
            message: targetMessage,
            index: indexOfMessage(targetMessage.id),
            toLevel: nextLevel,
            source,
        });
    }, [
        targetMessage, gameOver, words, hints, fallbackHint,
        patchTarget, indexOfMessage, date, policy, onRevealed,
    ]);
}
