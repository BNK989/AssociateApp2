import { MAX_HINT_LEVEL } from '@/lib/gameConfig';
import type { GameState, Message } from '@/hooks/useGameLogic';

/** The daily game runs as a single pseudo-game under this fixed id. */
const DAILY_GAME_ID = 'daily-game';

const MAX_STRIKES = 3;

/** Below this length a bubble has no room for a text label beside the dots. */
const MIN_LENGTH_FOR_STRIKE_LABEL = 10;

/** Warn the players when this many messages or fewer remain. */
const WARN_WITHIN_MESSAGES = 4;

/**
 * Where a bubble sits in its own life, which is what decides how loud it is.
 *
 * - `upcoming`: still ciphered and not the word being solved. Its job is to
 *   promise that the chain continues — nothing more.
 * - `active`: the word under the cursor. The only stage that is a workspace,
 *   so it is the only one allowed to carry the full hint, the shuffle and the
 *   remaining-guess dots at full weight.
 * - `settled`: solved, lost, or revealed. Its job is now to be a record —
 *   the word and its outcome — not to keep shouting the clue that produced it.
 */
export type MessageStage = 'upcoming' | 'active' | 'settled';

/**
 * How the AI clue is rendered at this stage.
 *
 * `collapsed` keeps the clue reachable behind a tap without letting a settled
 * word spend ninety pixels restating something the revealed word already says.
 */
export type HintDisplay = 'none' | 'open' | 'collapsed';

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
    stage: MessageStage;
    hintDisplay: HintDisplay;
    /** Held back behind the active word, so it reads as background. */
    isDimmed: boolean;
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

    const isTarget = isSolving && targetMessageId === message.id;
    const stage: MessageStage = isTarget ? 'active' : isVisible ? 'settled' : 'upcoming';

    return {
        isVisible,
        isMe: message.user_id === currentUserId,
        isTarget,
        isFailed,
        isCorrect,
        strikes,
        showStrikeIndicator,
        canShuffle,
        needsExtraPadding: canShuffle || showStrikeIndicator,
        stage,
        hintDisplay: deriveHintDisplay(message, stage, isSolving),
        isDimmed: isSolving && stage === 'upcoming',
    };
}

/**
 * Which clue treatment a bubble gets.
 *
 * The load-bearing case is `upcoming` during solving. The `every-word` start
 * reach seeds the whole chain at its entitled level up front, so without this
 * every word the player has not reached yet would sit there with its answer
 * described in full. Withholding it here is a display decision only — the clue
 * stays on the message, so entitlement and scoring are untouched.
 *
 * Outside solving there is no word to look ahead to, so nothing is withheld.
 */
function deriveHintDisplay(message: Message, stage: MessageStage, isSolving: boolean): HintDisplay {
    const hasHint = message.hint_level >= MAX_HINT_LEVEL || Boolean(message.ai_hint);
    if (!hasHint) return 'none';

    if (stage === 'settled') return 'collapsed';
    if (stage === 'active') return 'open';

    return isSolving ? 'none' : 'open';
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
