import type { GameState, Message } from '@/hooks/useGameLogic';

/** The daily game runs as a single pseudo-game under this fixed id. */
const DAILY_GAME_ID = 'daily-game';

const MAX_STRIKES = 3;

/** Below this length a bubble has no room for a text label beside the dots. */
const MIN_LENGTH_FOR_STRIKE_LABEL = 10;

/** Warn the players when this many messages or fewer remain. */
const WARN_WITHIN_MESSAGES = 4;

export type MessageFlags = {
    /** The word is readable rather than ciphered. */
    isVisible: boolean;
    isMe: boolean;
    isTarget: boolean;
    /** Solved but scored nothing — a give-up or a third strike. */
    isFailed: boolean;
    /** Solved for points. */
    isCorrect: boolean;
    strikes: number;
    showStrikeIndicator: boolean;
    /** The word is partially revealed, so tapping it can re-scramble. */
    canShuffle: boolean;
    needsExtraPadding: boolean;
};

type DeriveArgs = {
    message: Message;
    isLastMessage: boolean;
    game: GameState;
    currentUserId?: string;
    targetMessageId?: string;
    /** Admin override that force-reveals a message. */
    isRevealed: boolean;
};

/**
 * Presentation flags for a single chat message.
 *
 * The subtle rule is what counts as "failed": a message can be solved yet score
 * nothing, either because the player gave up or because they burned all three
 * strikes. Both look the same in the data (`is_solved` with no winner points),
 * so both render as lost — except for the daily game's seeded opening word,
 * which is handed to the player already solved and worth nothing, and must not
 * be shown as a failure.
 */
export function deriveMessageFlags({
    message,
    isLastMessage,
    game,
    currentUserId,
    targetMessageId,
    isRevealed,
}: DeriveArgs): MessageFlags {
    const isSolving = game.status === 'solving';
    const isVisible = Boolean(message.is_solved) || (!isSolving && isLastMessage);

    const strikes = message.strikes || 0;
    const winnerPoints = message.winner_points || 0;

    const isGivenUp = Boolean(message.is_solved) && winnerPoints === 0;
    const isDailyStart = game.id === DAILY_GAME_ID && isLastMessage;
    const isFailed = ((strikes >= MAX_STRIKES && Boolean(message.is_solved)) || isGivenUp) && !isDailyStart;
    const isCorrect = Boolean(message.is_solved) && !isFailed && winnerPoints > 0;

    const showStrikeIndicator =
        (strikes > 0 && strikes < MAX_STRIKES && !isVisible) || isFailed || isCorrect;

    const canShuffle = message.hint_level >= 2 && !isVisible && !isRevealed;

    return {
        isVisible,
        isMe: message.user_id === currentUserId,
        isTarget: isSolving && targetMessageId === message.id,
        isFailed,
        isCorrect,
        strikes,
        showStrikeIndicator,
        canShuffle,
        needsExtraPadding: canShuffle || showStrikeIndicator,
    };
}

/** True when a strike bubble is wide enough to also carry its text label. */
export function shouldShowStrikeLabel(content: string): boolean {
    return content.length >= MIN_LENGTH_FOR_STRIKE_LABEL;
}

/**
 * How many messages remain before the chain hits its cap, or `null` when no
 * warning should be shown (not in texting mode, no cap, or still far away).
 */
export function getMessagesLeftWarning(
    game: GameState,
    messageIndex: number,
): number | null {
    if (game.status === 'solving' || !game.max_messages) return null;

    const messagesLeft = game.max_messages - (messageIndex + 1);
    if (messagesLeft <= 0 || messagesLeft >= WARN_WITHIN_MESSAGES) return null;

    return messagesLeft;
}
