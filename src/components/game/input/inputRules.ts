import type { GameState, Message, Player } from '@/hooks/useGameLogic';
import { GAME_CONFIG, SETTLE } from '@/lib/gameConfig';
import { calculateMessageValue, calculateRevealedPercentage, HINT_COSTS } from '@/lib/gameLogic';
import { calculateSolvePoints, MAX_HINT_LEVEL } from '@/lib/daily/dailyScoring';
import { DEFAULT_HINT_POLICY, type HintProgression } from '@/lib/daily/hintPolicy';

/**
 * Whose word is in play: the turn holder while texting, the author of the
 * target word while solving.
 */
export function getActivePlayerId(game: GameState, targetMessage?: Message): string | undefined {
    if (game.status === 'solving' && targetMessage) {
        return targetMessage.user_id;
    }
    return game.current_turn_user_id;
}

type TurnStateArgs = {
    game: GameState;
    players: Player[];
    targetMessage?: Message;
    currentUserId?: string;
    solvingTimeLeft: number | null;
    isSinglePlayer: boolean;
};

export type TurnState = {
    isMyTurn: boolean;
    /** Anyone may answer, not just the word's author. */
    isFreeForAll: boolean;
    targetPlayer?: Player;
    targetPlayerHasLeft: boolean;
};

/**
 * Who may answer right now.
 *
 * The author owns their word until the timer runs out. Two things open it up
 * early: a single-player game has no one to wait for, and a word whose author
 * has left would otherwise be unanswerable forever.
 */
export function getTurnState({
    game,
    players,
    targetMessage,
    currentUserId,
    solvingTimeLeft,
    isSinglePlayer,
}: TurnStateArgs): TurnState {
    const activePlayerId = getActivePlayerId(game, targetMessage);
    const targetPlayer = players.find((p) => p.user_id === activePlayerId);
    const targetPlayerHasLeft = targetPlayer?.has_left || false;

    return {
        isMyTurn: activePlayerId === currentUserId,
        isFreeForAll: isSinglePlayer || solvingTimeLeft === 0 || targetPlayerHasLeft,
        targetPlayer,
        targetPlayerHasLeft,
    };
}

/** Whether the send button should be inert. */
export function isSubmitDisabled(args: {
    game: GameState;
    sending: boolean;
    isEmpty: boolean;
    isMyTurn: boolean;
    isFreeForAll: boolean;
}): boolean {
    const { game, sending, isEmpty, isMyTurn, isFreeForAll } = args;

    if (sending) return true;
    // The empty-chain prompt lets anyone seed the first word.
    if (isEmpty) return false;

    return game.status === 'solving'
        ? (!isFreeForAll && !isMyTurn)
        : !isMyTurn;
}

/**
 * The hint level to price and label the button against.
 *
 * This mirrors the skips the hint ladder itself applies, so the button never
 * advertises a hint the player would not actually receive: level 1 is treated
 * as already spent when guesses exposed the first letter, and level 2 as
 * already spent when the word is mostly revealed and re-scrambling it would
 * tell them nothing.
 */
export function getEffectiveHintLevel(targetMessage?: Message): number {
    const currentLevel = targetMessage?.hint_level || 0;
    if (!targetMessage) return currentLevel;

    const firstLetter = targetMessage.content?.[0]?.toLowerCase();
    const guesses = targetMessage.guesses || [];
    const firstLetterKnown = Boolean(firstLetter)
        && guesses.some((g) => g.toLowerCase().includes(firstLetter));

    let effective = currentLevel === 0 && firstLetterKnown ? 1 : currentLevel;

    if (effective === 1) {
        const revealed = calculateRevealedPercentage(targetMessage.content, guesses);
        if (revealed >= GAME_CONFIG.PERCENT_REVEALED_SHUFFLE_HINT) {
            effective = 2;
        }
    }

    return effective;
}

export type HintTier = {
    /** Points this hint will cost, deducted from the word's value on solve. */
    cost: number;
    /** i18n key describing what the next hint gives. */
    labelKey: 'reveal_len' | 'hint_2' | 'hint_clue';
    /**
     * Which rung's glyph the button wears; null renders the bulb alone.
     *
     * These name what the player *gets* — a length, a reshuffle, a written clue
     * — and deliberately not where it came from. The third rung used to be
     * badged `AI`, which told the player about the plumbing behind the clue and
     * nothing about the help in it, and invited them to discount the help
     * accordingly.
     */
    badge: 'length' | 'shuffle' | 'clue' | null;
};

/**
 * Cost and labelling for the next hint.
 *
 * Under the `jump` progression the ladder is skipped entirely — every hint goes
 * straight to the written clue — so the button shows no intermediate glyph that
 * would imply a step the player will not pass through.
 */
export function getHintTier(
    effectiveLevel: number,
    targetMessage?: Message,
    progression: HintProgression = DEFAULT_HINT_POLICY.progression,
    clueCost: number = SETTLE.CLUE_COST,
): HintTier | null {
    if (!targetMessage || effectiveLevel >= MAX_HINT_LEVEL) return null;

    const wordValue = calculateMessageValue(targetMessage.content);
    const revealsEverything = progression === 'jump';

    if (effectiveLevel === 0) {
        return {
            cost: Math.ceil(wordValue * HINT_COSTS.TIER_1),
            labelKey: 'reveal_len',
            badge: revealsEverything ? null : 'length',
        };
    }

    if (effectiveLevel === 1) {
        return {
            cost: Math.ceil(wordValue * HINT_COSTS.TIER_2),
            labelKey: 'hint_2',
            badge: revealsEverything ? null : 'shuffle',
        };
    }

    // The clue carries the settle policy's price on top of its tier, and the
    // header button quotes it so it never charges silently for what the stuck
    // offer prices out loud.
    return {
        cost: Math.ceil(wordValue * (HINT_COSTS.TIER_3 + clueCost)),
        labelKey: 'hint_clue',
        badge: revealsEverything ? null : 'clue',
    };
}

/**
 * What the word is still worth if the player takes this hint and then solves it.
 *
 * The composer used to state the hint's price and nothing else — "-12 pts",
 * "Deducted from word value" — which is the whole transaction told from the
 * losing side. The same number framed as what survives reads as a trade rather
 * than a fine, and it is the number the player actually decides on.
 *
 * Streak-free on purpose: a multiplier the player may or may not still hold by
 * the time they solve would make this a promise the game cannot keep.
 */
export function valueAfterHint(
    targetMessage: Message,
    effectiveLevel: number,
    clueCost: number = SETTLE.CLUE_COST,
): number {
    return calculateSolvePoints(targetMessage.content, effectiveLevel + 1, 0, { clueCost });
}

/** Non-space character count, which is what the counter compares. */
export function countMeaningfulChars(text: string): number {
    return text.replace(/\s/g, '').length;
}
