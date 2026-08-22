import type { Message } from '@/hooks/useGameLogic';
import { generateCipherString } from '@/lib/gameLogic';

// One definition, shared with classic mode.
export { findTargetMessage } from '@/lib/gameLogic';
import { MAX_HINT_LEVEL } from './dailyScoring';
import { MAX_STRIKES } from '@/lib/gameLogic';

/** The daily chain is authored by a bot rather than a real player. */
export const BOT_USER_ID = 'daily-bot';

/** The local player's stand-in id; the daily game has no real multiplayer identity. */
export const LOCAL_USER_ID = 'me';

export const BOT_PROFILE = {
    username: 'Daily Bot',
    avatar_url: '/logos/android-chrome-192x192.png',
};

export const MY_PROFILE = {
    username: 'You',
    avatar_url: 'https://api.dicebear.com/9.x/thumbs/svg?seed=guest',
};

/** Words still in play once `solvedId` is taken out. Zero means the game is over. */
export function countRemainingAfterSolve(messages: Message[], solvedId: string): number {
    return messages.filter(
        (m) => !m.is_solved && m.id !== solvedId && (m.strikes || 0) < MAX_STRIKES,
    ).length;
}

type BuildArgs = {
    words: string[];
    /** Hint level to pre-apply to the first word the player will face. */
    initialHintLevel?: number;
    hints?: string[] | null;
    connectionScores?: number[] | null;
    /** Fallback clue text, used when no authored hint exists for a word. */
    fallbackHint?: (word: string) => string;
    /** When true the final word starts unsolved so it can be typed out on entry. */
    animateStartWord?: boolean;
};

/**
 * Builds the in-memory message list for a fresh daily game.
 *
 * The chain is presented newest-last, and the *final* word is the one the
 * player is given for free — so it starts solved, unless the entry animation is
 * going to type it out instead. Only the word immediately before it carries any
 * pre-applied hint level.
 */
export function buildInitialMessages({
    words,
    initialHintLevel = 0,
    hints,
    connectionScores,
    fallbackHint,
    animateStartWord = false,
}: BuildArgs): Message[] {
    const startIndex = words.length - 1;
    const firstTargetIndex = words.length - 2;
    const clampedHintLevel = Math.max(0, Math.min(MAX_HINT_LEVEL, initialHintLevel));

    return words.map((word, index) => {
        const hintLevel = index === firstTargetIndex ? clampedHintLevel : 0;

        let aiHint: string | undefined;
        if (hintLevel === MAX_HINT_LEVEL) {
            aiHint = hints?.[index] ?? fallbackHint?.(word);
        }

        return {
            id: `msg-${index}`,
            content: word,
            cipher_length: word.length,
            is_solved: index === startIndex && !animateStartWord,
            user_id: BOT_USER_ID,
            // Spaced a second apart so the chain sorts in authored order.
            created_at: new Date(Date.now() - (words.length - index) * 1000).toISOString(),
            strikes: 0,
            hint_level: hintLevel,
            cipher_text: generateCipherString(word, hintLevel, true),
            ai_hint: aiHint,
            connection_score: connectionScores?.[index] ?? undefined,
            author_points: 0,
            winner_points: 0,
            type: 'text' as const,
            profiles: BOT_PROFILE,
            guesses: [],
        };
    });
}

/**
 * Repairs messages restored from localStorage.
 *
 * Two things drift across releases: level-0 ciphers used to be generated at a
 * random length rather than matching the word, which leaks nothing but looks
 * wrong; and the bot's avatar has changed, so saved games would keep rendering
 * the old one.
 */
export function sanitizeRestoredMessages(messages: Message[]): Message[] {
    return messages.map((message) => {
        const next = { ...message };

        if (message.hint_level === 0 && (message.cipher_text?.length ?? 0) !== message.content.length) {
            next.cipher_text = generateCipherString(message.content, 0, true);
        }

        if (message.user_id === BOT_USER_ID) {
            next.profiles = BOT_PROFILE;
        }

        return next;
    });
}
