import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import type { User } from '@supabase/supabase-js';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { GameState, Message, Player } from '@/hooks/useGameLogic';
import { MAX_HINT_LEVEL } from '@/lib/daily/dailyScoring';
import { LETTER_POOL } from '@/lib/gameConfig';
import { LetterPool } from '@/components/game/pool/LetterPool';
import { useSlotTyping } from './input/useSlotTyping';
import { GiveUpButton } from './input/GiveUpButton';
import { HintButton } from './input/HintButton';
import { LegendButton } from './input/LegendButton';
import { MessageInput } from './input/MessageInput';
import { getEffectiveHintLevel, getHintTier, getTurnState, isSubmitDisabled } from './input/inputRules';
import { useHintNudge } from './input/useHintNudge';
import { useHintTooltip } from './input/useHintTooltip';
import { usePlaceholder } from './input/usePlaceholder';

type GameInputProps = {
    game: GameState;
    user: User | null;
    players: Player[];
    input: string;
    setInput: (value: string) => void;
    sending: boolean;
    solvingTimeLeft: number | null;
    targetMessage?: Message;
    onSendMessage: (e: React.FormEvent) => void;
    onGetHint: () => void;
    isEmpty?: boolean;
    onTyping?: () => void;
    isSinglePlayer?: boolean;
    onGiveUp?: () => void;
    autoHintProgress?: number;
    autoHintSecondsLeft?: number;
    isAutoHintActive?: boolean;
    isHintPaused?: boolean;
    onToggleHintPause?: () => void;
    onOpenSettings?: () => void;
    /**
     * Whether the caret jumps over confirmed letters, so the player types only
     * the gaps. A game-master setting; falls back to the compiled default when
     * the settings table is unreachable.
     */
    caretSkipsGreens?: boolean;
};

/**
 * The composer at the foot of the game: hint controls, the text field, and send.
 *
 * What it offers depends on the phase and on whether the current word is the
 * player's to answer — see `inputRules` for those decisions.
 */
export function GameInput({
    game,
    user,
    players,
    input,
    setInput,
    sending,
    solvingTimeLeft,
    targetMessage,
    onSendMessage,
    onGetHint,
    isEmpty = false,
    onTyping,
    isSinglePlayer = false,
    onGiveUp,
    autoHintProgress = 0,
    autoHintSecondsLeft = 0,
    isAutoHintActive = false,
    isHintPaused = false,
    onToggleHintPause,
    onOpenSettings,
    caretSkipsGreens = LETTER_POOL.CARET_SKIPS_GREENS,
}: GameInputProps) {
    const t = useTranslations('GameRoom.Input');

    const turn = getTurnState({
        game,
        players,
        targetMessage,
        currentUserId: user?.id,
        solvingTimeLeft,
        isSinglePlayer,
    });

    const placeholder = usePlaceholder({ game, turn, solvingTimeLeft, isSinglePlayer });

    const effectiveLevel = getEffectiveHintLevel(targetMessage);
    const isMaxHints = effectiveLevel >= MAX_HINT_LEVEL;
    const tier = getHintTier(effectiveLevel, targetMessage);

    const canAnswer = turn.isMyTurn || turn.isFreeForAll;
    const controlsDisabled = !canAnswer || sending;

    const tooltip = useHintTooltip({ game, targetMessage, isMaxHints });
    const nudgeStage = useHintNudge({
        game,
        targetMessage,
        isMaxHints,
        canAnswer,
        isAutoHintActive,
    });

    const isSolving = game.status === 'solving';
    const showHintControls = isSolving && Boolean(targetMessage);

    /**
     * The strip discloses the answer's length, so it appears exactly where the
     * `typed / total` counter already did — never earlier. Same gate, same
     * information, one fewer thing in the composer.
     */
    const showTargetLength = isSinglePlayer || (targetMessage?.hint_level || 0) >= 1;
    const stripActive = LETTER_POOL.ENABLED && isSolving && Boolean(targetMessage) && showTargetLength;

    const { typed, onTypedChange, normalise, model } = useSlotTyping({
        text: stripActive && targetMessage ? targetMessage.content : null,
        guesses: targetMessage?.guesses || [],
        mode: caretSkipsGreens ? 'skip' : 'full',
        // The same mask the bubble draws. Below hint 2 it confirms positions;
        // from hint 2 its anagram is where a purchased hint's letters come
        // from, and without it buying one would reveal nothing at all.
        mask: targetMessage?.cipher_text
            ? { cipher: targetMessage.cipher_text, hintLevel: targetMessage.hint_level || 0 }
            : undefined,
        targetId: targetMessage?.id,
        setInput,
    });

    // Matches `CipherText`, so the strip and the word above it never disagree
    // about which way the answer reads.
    const dir = targetMessage && /[֐-׿]/.test(targetMessage.content) ? 'rtl' : 'ltr';

    // Guests cannot buy the AI hint, so they get an escape hatch beside it.
    const showGuestGiveUp = showHintControls
        && !isMaxHints
        && (targetMessage?.hint_level || 0) === 2
        && Boolean(user?.is_anonymous);

    const hintButton = (
        <HintButton
            tier={tier}
            disabled={controlsDisabled}
            sending={sending}
            nudgeStage={nudgeStage}
            isAutoHintActive={isAutoHintActive && !isMaxHints}
            autoHintProgress={autoHintProgress}
            autoHintSecondsLeft={autoHintSecondsLeft}
            isHintPaused={isHintPaused}
            onGetHint={onGetHint}
            onToggleHintPause={onToggleHintPause}
            onGiveUp={onGiveUp}
            onOpenSettings={onOpenSettings}
            onInteract={tooltip.markInteracted}
        />
    );

    return (
        <div
            className="shrink-0 z-20 w-full px-2 pt-2 pb-1 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
            onClick={tooltip.markInteracted}
            onTouchStart={tooltip.markInteracted}
        >
            <TooltipProvider>
                <LayoutGroup>
                {model && (
                    <LetterPool
                        letters={model.pool}
                        placed={model.placed}
                        dir={dir}
                    />
                )}

                <div className="flex gap-2 items-center relative">
                    <AnimatePresence>
                        {isSolving && turn.isFreeForAll && !isSinglePlayer && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute -top-3 end-14 z-10"
                            >
                                <Badge variant="subtle" className="shadow-sm">
                                    {t('free_for_all')}
                                </Badge>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {showHintControls && (
                        isMaxHints ? (
                            <GiveUpButton
                                id="hint-button-trigger"
                                disabled={controlsDisabled}
                                onGiveUp={onGiveUp}
                            />
                        ) : tooltip.hasSeen ? (
                            hintButton
                        ) : (
                            <Tooltip open={tooltip.isOpen} onOpenChange={tooltip.setIsOpen}>
                                <TooltipTrigger asChild>{hintButton}</TooltipTrigger>
                                <TooltipContent side="top" align="start">
                                    <div className="text-xs space-y-1">
                                        <p className="font-bold">{tier ? t(tier.labelKey) : ''}</p>
                                        <p className="text-muted-foreground">
                                            {t('cost_pts', { cost: -(tier?.cost ?? 0) })}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground opacity-70">
                                            {t('cost_deducted')}
                                        </p>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        )
                    )}

                    {showGuestGiveUp && (
                        <GiveUpButton disabled={controlsDisabled} onGiveUp={onGiveUp} />
                    )}

                    {showHintControls && <LegendButton hintLevel={effectiveLevel} />}

                    <MessageInput
                        game={game}
                        input={input}
                        setInput={setInput}
                        sending={sending}
                        submitDisabled={isSubmitDisabled({
                            game,
                            sending,
                            isEmpty,
                            isMyTurn: turn.isMyTurn,
                            isFreeForAll: turn.isFreeForAll,
                        })}
                        placeholder={placeholder}
                        targetMessage={targetMessage}
                        showTargetLength={showTargetLength}
                        strip={model ? {
                            groups: model.groups,
                            longest: model.longest,
                            caretIndex: model.caretIndex,
                            dir,
                        } : null}
                        typedValue={typed}
                        onTypedChange={model ? onTypedChange : undefined}
                        normalizeTyped={normalise}
                        onSend={onSendMessage}
                        onTyping={onTyping}
                        onInteract={tooltip.markInteracted}
                    />
                </div>
                </LayoutGroup>
            </TooltipProvider>
        </div>
    );
}
