import { useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import type { User } from '@supabase/supabase-js';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { GameState, Message, Player } from '@/hooks/useGameLogic';
import { MAX_HINT_LEVEL } from '@/lib/daily/dailyScoring';
import { LETTER_POOL } from '@/lib/gameConfig';
import { layoutHalo } from '@/lib/letterPool/haloLayout';
import { LetterHalo, useHaloAnchor } from '@/components/game/pool/LetterHalo';
import { LetterFlight } from '@/components/game/pool/LetterFlight';
import { useLetterFlights } from '@/components/game/pool/useLetterFlights';
import { useSlotTyping } from './input/useSlotTyping';
import { RevealButton } from './input/RevealButton';
import { HintButton } from './input/HintButton';
import { MessageInput } from './input/MessageInput';
import { getEffectiveHintLevel, getHintTier, getTurnState, isSubmitDisabled } from './input/inputRules';
import { useHintNudge } from './input/useHintNudge';
import { useHintTooltip } from './input/useHintTooltip';
import { usePlaceholder } from './input/usePlaceholder';

/** Stable empties, so a composer with no word does not rebuild them per render. */
const EMPTY_IDS: Set<string> = new Set();
const EMPTY_PLACEMENTS: Map<string, number> = new Map();

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
    onReveal?: () => void;
    canOpenOtherEnd?: boolean;
    onOpenOtherEnd?: () => void;
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
    onReveal,
    canOpenOtherEnd,
    onOpenOtherEnd,
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

    // The found letters hang around the target bubble, not in the composer, so
    // the composer only has to know which element to hand them to.
    const haloAnchor = useHaloAnchor(stripActive ? targetMessage?.id : undefined);

    // Placing a letter is one state change told in two places at once. The
    // composer owns both ends, so it is the only place that can keep them in
    // step: it hides the chip, holds the slot blank, and flies the letter
    // between them.
    const reducedMotion = Boolean(useReducedMotion());

    // The one solve of where the letters hang, shared by the halo that draws
    // them and the flight that has to leave from exactly there.
    const isOwnTarget = Boolean(user?.id) && targetMessage?.user_id === user?.id;
    const haloPlacements = useMemo(
        () => layoutHalo(model?.pool ?? [], isOwnTarget),
        [model?.pool, isOwnTarget],
    );

    const flight = useLetterFlights({
        placed: model?.placed ?? EMPTY_IDS,
        placements: model?.placements ?? EMPTY_PLACEMENTS,
        letters: haloPlacements,
        reduced: reducedMotion,
    });

    // Matches `CipherText`, so the strip and the word above it never disagree
    // about which way the answer reads.
    const dir = targetMessage && /[֐-׿]/.test(targetMessage.content) ? 'rtl' : 'ltr';

    // Guests cannot buy the AI hint, so they get an escape hatch beside it.
    const showGuestReveal = showHintControls
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
            onReveal={onReveal}
            canOpenOtherEnd={canOpenOtherEnd}
            onOpenOtherEnd={onOpenOtherEnd}
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
                {model && (
                    <LetterHalo
                        placements={haloPlacements}
                        hidden={flight.hidden}
                        anchor={haloAnchor}
                    />
                )}

                <LetterFlight flights={flight.flights} onLand={flight.land} />

                <div className="flex gap-2 items-center relative">
                    <AnimatePresence>
                        {isSolving && turn.isFreeForAll && !isSinglePlayer && (
                            <motion.div
                                // Clear of the composer's top rule, not across
                                // it. At `-top-3` the pill straddled that 1px
                                // border, and since it fades in and out the
                                // border showed through the translucent pill
                                // mid-animation and read as a line struck
                                // through the words. `bottom-full` + `mb-3`
                                // parks it wholly above the rule, and the entry
                                // now settles downward so no frame of it ever
                                // crosses the line either.
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="pointer-events-none absolute bottom-full end-14 z-30 mb-3"
                            >
                                <Badge variant="subtle" className="shadow-sm">
                                    {t('free_for_all')}
                                </Badge>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {showHintControls && (
                        isMaxHints ? (
                            <RevealButton
                                id="hint-button-trigger"
                                disabled={controlsDisabled}
                                onReveal={onReveal}
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

                    {showGuestReveal && (
                        <RevealButton disabled={controlsDisabled} onReveal={onReveal} />
                    )}

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
                            held: flight.held,
                        } : null}
                        typedValue={typed}
                        onTypedChange={model ? onTypedChange : undefined}
                        normalizeTyped={normalise}
                        onSend={onSendMessage}
                        onTyping={onTyping}
                        onInteract={tooltip.markInteracted}
                    />
                </div>
            </TooltipProvider>
        </div>
    );
}
