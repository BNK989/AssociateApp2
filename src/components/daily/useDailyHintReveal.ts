import { useCallback } from 'react';
import type { Message } from '@/hooks/useGameLogic';
import { generateCipherString } from '@/lib/gameLogic';
import { createLogger } from '@/lib/logger';
import { getNextHintLevel, MAX_HINT_LEVEL, needsScrambleVisuals } from '@/lib/daily/dailyScoring';
import type { DailyHintPolicy } from '@/lib/daily/hintPolicy';

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
}: UseDailyHintRevealArgs) {
    return useCallback(async (fetchHint?: (index: number) => Promise<string | null>) => {
        if (!targetMessage || gameOver) return;

        const currentLevel = targetMessage.hint_level || 0;
        if (currentLevel >= MAX_HINT_LEVEL) return;

        const nextLevel = getNextHintLevel({
            currentLevel,
            word: targetMessage.content,
            guesses: targetMessage.guesses || [],
            progression: policy.progression,
        });

        const cipherLevel = Math.min(nextLevel, 2);
        const newCipherText = nextLevel < MAX_HINT_LEVEL || needsScrambleVisuals(currentLevel, nextLevel)
            ? generateCipherString(targetMessage.content, cipherLevel, true)
            : (targetMessage.cipher_text || generateCipherString(targetMessage.content, 2, true));

        const updates: Partial<Message> = { hint_level: nextLevel, cipher_text: newCipherText };

        if (nextLevel === MAX_HINT_LEVEL) {
            const index = words.indexOf(targetMessage.content);
            let clue = hints?.[index] ?? fallbackHint(targetMessage.content);

            if (!hints && fetchHint && index !== -1) {
                try {
                    clue = (await fetchHint(index)) ?? clue;
                } catch (e) {
                    log.error('fetch_hint', 'Failed to fetch AI hint', { play_date: date }, e);
                }
            }

            updates.ai_hint = clue;
        }

        patchTarget(targetMessage.id, updates);
    }, [targetMessage, gameOver, words, hints, fallbackHint, patchTarget, date, policy]);
}
