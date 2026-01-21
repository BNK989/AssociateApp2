import { GameState, Player, Message } from '@/hooks/useGameLogic';
import { User } from '@supabase/supabase-js';
import { calculateMessageValue, HINT_COSTS, calculateRevealedPercentage } from '@/lib/gameLogic';
import { Send, Loader2, Shuffle, Pause, Play, Settings as SettingsIcon, Flag, Clock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useRef } from 'react';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { toast } from "sonner";
import { useTranslations } from 'next-intl';

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
    onTyping?: () => void; // New prop for triggering broadcast
    isSinglePlayer?: boolean;
    onGiveUp?: () => void;
    // Auto Hint Props
    autoHintProgress?: number; // 0 to 100
    autoHintSecondsLeft?: number;
    isAutoHintActive?: boolean;
    isHintPaused?: boolean;
    onToggleHintPause?: () => void;
    onOpenSettings?: () => void;
};

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
    onOpenSettings
}: GameInputProps) {
    const t = useTranslations('GameRoom.Input');

    // Determine who has the "turn"
    let activePlayerId = game.current_turn_user_id;
    if (game.status === 'solving' && targetMessage) {
        activePlayerId = targetMessage.user_id;
    }

    const isMyTurn = activePlayerId === user?.id;
    const targetPlayer = players.find(p => p.user_id === activePlayerId);

    // If the target player has left, force Free For All mode immediately
    const targetPlayerHasLeft = targetPlayer?.has_left || false;
    const isFreeForAll = isSinglePlayer || solvingTimeLeft === 0 || targetPlayerHasLeft;

    // Determine Placeholder Text
    let placeholderText = t('placeholder');
    if (game.status === 'solving') {
        if (isSinglePlayer) {
            placeholderText = t('placeholder_solving_single');
        } else if (isFreeForAll) {
            if (isMyTurn) {
                // Should technically be impossible if I left, but handle gracefully
                placeholderText = t('placeholder_solving_single');
            } else {
                const authorName = targetPlayer?.profiles?.username || 'Author';
                if (targetPlayerHasLeft) {
                    placeholderText = t('placeholder_free');
                } else {
                    placeholderText = t('placeholder_solving_other', { user: authorName, seconds: solvingTimeLeft ?? 0 });
                }
            }
        } else if (isMyTurn) {
            placeholderText = t('placeholder_solving_me', { seconds: solvingTimeLeft ?? 0 });
        } else {
            placeholderText = t('placeholder_solving_other', { user: targetPlayer?.profiles?.username || 'Author', seconds: solvingTimeLeft ?? 0 });
        }
    } else {
        if (isMyTurn) {
            placeholderText = t('placeholder_turn_me');
        } else {
            placeholderText = t('placeholder_turn_other', { user: targetPlayer?.profiles?.username || 'someone else' });
        }
    }

    // Determine if Input is Disabled (Never disabled during active game to keep keyboard open)
    const isInputDisabled = false;

    // Determine if Submit is Disabled (sending or not my turn)
    const isSubmitDisabled = sending || (
        isEmpty ? false : (
            game.status === 'solving'
                ? (!isFreeForAll && !isMyTurn)
                : !isMyTurn
        )
    );

    // Hint Logic
    const currentLevel = targetMessage?.hint_level || 0;
    const firstLetter = targetMessage?.content?.[0]?.toLowerCase();
    const isFirstLetterRevealed = firstLetter && targetMessage?.guesses?.some(g => g.toLowerCase().includes(firstLetter));

    // If we are at Level 0 but first letter is revealed, treat as Level 1 (Next is 2)
    let effectiveLevel = (currentLevel === 0 && isFirstLetterRevealed) ? 1 : currentLevel;

    // Check for Skip condition (Level 2 Skip)
    if (effectiveLevel === 1) {
        const revealedPct = calculateRevealedPercentage(targetMessage?.content || '', targetMessage?.guesses || []);
        if (revealedPct >= GAME_CONFIG.PERCENT_REVEALED_SHUFFLE_HINT) {
            effectiveLevel = 2;
        }
    }

    const isMaxHints = effectiveLevel >= 3;
    const wordValue = targetMessage ? calculateMessageValue(targetMessage.content) : 0;

    let nextCost = 0;
    let nextLabel = "";
    let buttonText: React.ReactNode = t('hint_1');

    if (effectiveLevel === 0) {
        nextCost = Math.ceil(wordValue * HINT_COSTS.TIER_1); // 10%
        nextLabel = t('reveal_len');
        buttonText = t('hint_1');
    } else if (effectiveLevel === 1) {
        nextCost = Math.ceil(wordValue * HINT_COSTS.TIER_2); // 10%
        nextLabel = t('hint_2');
        buttonText = <Shuffle className="h-3 w-3" />;
    } else if (effectiveLevel === 2) {
        nextCost = Math.ceil(wordValue * HINT_COSTS.TIER_3); // 40%
        nextLabel = t('hint_ai');
        buttonText = "AI";
    }

    // If Reveal Type is ALL, we jump 0->3, so we shouldn't show intermediate icons (Shuffle/AI).
    // Always show generic Hint text/icon until maxed.
    if (GAME_CONFIG.DEFAULT_AUTO_HINT_REVEAL_TYPE === 'ALL' && effectiveLevel < 3) {
        buttonText = null;
    }

    // Dropdown Control
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Auto-show tooltip logic
    const [isTooltipOpen, setIsTooltipOpen] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [hasSeenTooltip, setHasSeenTooltip] = useState(false);
    const TOOLTIP_STORAGE_KEY = 'associ8-hint-tooltip-seen';

    useEffect(() => {
        // Check global seen state immediately
        const seen = localStorage.getItem(TOOLTIP_STORAGE_KEY);
        if (seen) {
            setHasSeenTooltip(true);
            return;
        }

        if (game.status !== 'solving' || !targetMessage || isMaxHints) return;

        const timer = setTimeout(() => {
            if (!hasInteracted) {
                setIsTooltipOpen(true);
                localStorage.setItem(TOOLTIP_STORAGE_KEY, 'true');
                setHasSeenTooltip(true);
            }
        }, 5000);

        return () => clearTimeout(timer);
    }, [game.status, targetMessage, isMaxHints, hasInteracted, game.id]);

    const handleInteraction = () => {
        // Always mark as seen on interaction
        if (!hasSeenTooltip) {
            localStorage.setItem(TOOLTIP_STORAGE_KEY, 'true');
            setHasSeenTooltip(true);
        }

        if (!hasInteracted) {
            setHasInteracted(true);
            setIsTooltipOpen(false);
        }
    };

    // Animation Logic
    const [animationStage, setAnimationStage] = useState<'idle' | 'gentle' | 'intense'>('idle');

    useEffect(() => {
        setAnimationStage('idle');

        // Only run animation logic if it's my turn/free for all, message is unsolved, and hints aren't maxed
        // AND auto-hint is NOT active (no need to nudge if it's happening automatically)
        if (game.status !== 'solving' || !targetMessage || isMaxHints || (!isMyTurn && !isFreeForAll) || isAutoHintActive) return;

        const gentleTimer = setTimeout(() => {
            setAnimationStage('gentle');
        }, 5000);

        const intenseTimer = setTimeout(() => {
            setAnimationStage('intense');
        }, 15000); // 10 seconds after gentle

        return () => {
            clearTimeout(gentleTimer);
            clearTimeout(intenseTimer);
        };
    }, [game.status, targetMessage?.id, isMaxHints, isMyTurn, isFreeForAll]);

    const jumpAndVibrate = {
        idle: { y: 0, x: 0, rotate: 0 },
        gentle: {
            y: [0, -4, 0, -2, 0],
            x: [0, -1, 1, -1, 0],
            rotate: [0, -2, 2, -1, 0],
            transition: {
                duration: 0.6,
                repeat: Infinity,
                repeatDelay: 3 // Repeat every 3 seconds
            }
        },
        intense: {
            y: [0, -8, 0, -4, 0], // Higher jump
            x: [0, -3, 3, -2, 2, 0], // More vibration
            rotate: [0, -5, 5, -3, 3, 0], // More rotation
            scale: [1, 1.1, 1, 1.1, 1], // Slight grow effect
            transition: {
                duration: 0.5,
                repeat: Infinity,
                repeatDelay: 3 // Same frequency, higher intensity
            }
        }
    };

    const ProgressBorder = isAutoHintActive && !isMaxHints && !sending ? (
        <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
            <svg className="h-full w-full" viewBox="0 0 40 40">
                <rect
                    x="1" y="1" width="38" height="38" rx="7" ry="7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-purple-500/30"
                />
                <motion.rect
                    x="1" y="1" width="38" height="38" rx="7" ry="7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-purple-600 dark:text-purple-400"
                    strokeDasharray="140" // Approx perimeter
                    strokeDashoffset={140 * (1 - autoHintProgress / 100)}
                    initial={{ strokeDashoffset: 140 }}
                    animate={{ strokeDashoffset: 140 * (1 - autoHintProgress / 100) }}
                    transition={{ duration: 1, ease: "linear" }}
                />
            </svg>
        </div>
    ) : null;

    // Long Press Logic using Refs
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const isLongPress = useRef(false);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 2) e.preventDefault(); // Keep focus
        isLongPress.current = false;
        longPressTimer.current = setTimeout(() => {
            isLongPress.current = true;
            handleInteraction();
            setIsDropdownOpen(true);
        }, 500); // 500ms for long press
    };

    const handlePointerUp = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const HintButton = (
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen} modal={false}>
            <DropdownMenuTrigger asChild>
                <div className="relative">
                    <motion.button
                        type="button"
                        disabled={(!isMyTurn && !isFreeForAll) || sending}
                        variants={jumpAndVibrate}
                        animate={animationStage}
                        whileTap={{ scale: 0.9 }}
                        onPointerDown={handlePointerDown}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onTap={() => {
                            if (!isLongPress.current) {
                                handleInteraction();
                                onGetHint();
                            }
                        }}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            handleInteraction();
                            setIsDropdownOpen(true);
                        }}
                        className="h-10 w-10 relative flex flex-col items-center justify-center rounded-lg transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                        id="hint-button-trigger"
                    >
                        {ProgressBorder}
                        <span className="text-sm leading-none mb-0.5 z-10">
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "💡"}
                        </span>
                        <span className="text-[10px] font-bold leading-none z-10">{buttonText}</span>
                    </motion.button>

                    {/* Auto Hint Badge / Pause Toggle */}
                    {isAutoHintActive && !isMaxHints && (
                        <div
                            className="absolute -top-3 -right-3 z-20 cursor-pointer"
                            onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault(); // Extra safety
                                if (onToggleHintPause) onToggleHintPause();
                            }}
                        >
                            <Badge variant={isHintPaused ? "destructive" : "secondary"} className="px-1 py-0 h-4 min-w-[32px] flex items-center justify-center gap-0.5 text-[9px] shadow-sm hover:scale-110 transition-transform bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 text-foreground">
                                {isHintPaused ? (
                                    <Play className="w-2.5 h-2.5 text-green-600 animate-pulse" />
                                ) : (
                                    <>
                                        <span className="font-mono font-bold leading-none">{autoHintSecondsLeft}</span>
                                        <div className="h-2 w-[1px] bg-border mx-0.5" />
                                        <Pause className="w-2.5 h-2.5 text-muted-foreground" />
                                    </>
                                )}
                            </Badge>
                        </div>
                    )}
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                // @ts-ignore - Radix prop validation issue
                onOpenAutoFocus={(e: Event) => e.preventDefault()}
                // @ts-ignore - Radix prop validation issue
                onCloseAutoFocus={(e: Event) => e.preventDefault()}
            >
                {isAutoHintActive && (
                    <DropdownMenuItem onClick={() => onToggleHintPause && onToggleHintPause()}>
                        {isHintPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                        {isHintPaused ? "Resume Auto Hint" : "Pause Auto Hint"}
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onGiveUp && onGiveUp()} className="text-red-600 focus:text-red-600">
                    <Flag className="w-4 h-4 mr-2" />
                    {t('give_up')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenSettings && onOpenSettings()}>
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Settings
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const GiveUpButton = (
        <button
            type="button"
            disabled={(!isMyTurn && !isFreeForAll) || sending}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
                e.preventDefault();
                if (onGiveUp) onGiveUp();
            }}
            className="h-10 w-10 flex flex-col items-center justify-center rounded-lg transition-colors bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('give_up')}
            id="hint-button-trigger"
        >
            <span className="text-lg leading-none">🏳️</span>
        </button>
    );

    return (
        <div
            className="shrink-0 z-20 w-full px-2 pt-2 pb-1 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
            onClick={handleInteraction}
            onTouchStart={handleInteraction}
        >
            <TooltipProvider>
                <form onSubmit={onSendMessage} autoComplete="off" className="flex gap-2 items-center relative">
                    {/* Hidden input to disable autofill on mobile */}
                    <input
                        type="text" // Must be text type to 'catch' the focus/autofill
                        name="hidden-autofill-bait"
                        autoComplete="new-password"
                        tabIndex={-1}
                        className="fixed top-0 left-0 w-1 h-1 opacity-0 pointer-events-none"
                    />
                    <AnimatePresence>
                        {game.status === 'solving' && isFreeForAll && !isSinglePlayer && (
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
                    {game.status === 'solving' && targetMessage && (
                        isMaxHints ? GiveUpButton : (
                            hasSeenTooltip ? HintButton : (
                                <Tooltip open={isTooltipOpen} onOpenChange={setIsTooltipOpen}>
                                    <TooltipTrigger asChild>
                                        {HintButton}
                                    </TooltipTrigger>
                                    <TooltipContent side="top" align="start">
                                        <div className="text-xs space-y-1">
                                            <p className="font-bold">{nextLabel}</p>
                                            <p className="text-muted-foreground">{t('cost_pts', { cost: -nextCost })}</p>
                                            <p className="text-[10px] text-muted-foreground opacity-70">{t('cost_deducted')}</p>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            )
                        )
                    )}
                    {/* Guest Escape Hatch: Show Give Up button when stuck at AI Hint level */}
                    {game.status === 'solving' && targetMessage && !isMaxHints && currentLevel === 2 && user?.is_anonymous && (
                        GiveUpButton
                    )}

                    <div id="game-input-area" className="flex gap-2 flex-1">
                        <div className="relative flex-1">
                            <input
                                id="q_search_8x"
                                name="q_search_8x"
                                type="text"
                                value={input}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck="false"
                                data-lpignore="true"
                                data-1p-ignore="true"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val.length > GAME_CONFIG.MESSAGE_MAX_LENGTH) {
                                        toast.error(t('toast_max_length', { max: GAME_CONFIG.MESSAGE_MAX_LENGTH }));
                                        import("sonner").then(mod => mod.toast.dismiss()); // optional cleanup
                                        return;
                                    }
                                    setInput(val);
                                    handleInteraction();
                                    if (onTyping && val.length > 0) {
                                        onTyping();
                                    }
                                }}
                                onFocus={handleInteraction}
                                disabled={isInputDisabled}
                                placeholder={placeholderText}
                                className={`h-10 w-full px-3 py-2 pe-14 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:border-blue-500 outline-none transition-colors ${game.status === 'solving' ? 'border-purple-500' : ''} ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                            {/* Character Counter */}
                            {(input.length > 0 || (game.status === 'solving' && targetMessage && (isSinglePlayer || currentLevel >= 1))) && (
                                <div
                                    data-testid="char-counter"
                                    className={`absolute end-3 top-1/2 -translate-y-1/2 text-xs font-medium select-none pointer-events-none transition-colors ${game.status === 'solving' && targetMessage && input.replace(/\s/g, '').length > targetMessage.content.replace(/\s/g, '').length
                                        ? 'text-red-500 dark:text-red-400'
                                        : 'text-gray-400 dark:text-gray-500'
                                        }`}>
                                    {input.replace(/\s/g, '').length}
                                    {(isSinglePlayer || currentLevel >= 1) && targetMessage && (
                                        <span data-testid="char-total" className="opacity-70"> / {targetMessage.content.replace(/\s/g, '').length}</span>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitDisabled}
                            onMouseDown={(e) => e.preventDefault()}
                            className={`h-10 w-10 flex items-center justify-center rounded-lg text-white font-bold shrink-0 transition-colors ${game.status === 'solving' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'} ${isSubmitDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 rtl:-scale-x-100" />}
                        </button>
                    </div>
                </form>
            </TooltipProvider>
        </div>
    );
}
