import { GameState, Player, Message } from '@/hooks/useGameLogic';
import { User } from '@supabase/supabase-js';
import { calculateMessageValue, HINT_COSTS } from '@/lib/gameLogic';
import { Send, Loader2, Shuffle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from 'react';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { toast } from "sonner";

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
    onGiveUp
}: GameInputProps) {

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
    let placeholderText = "Type a message...";
    if (game.status === 'solving') {
        if (isSinglePlayer) {
            placeholderText = "Guess the word...";
        } else if (isFreeForAll) {
            if (isMyTurn) {
                // Should technically be impossible if I left, but handle gracefully
                placeholderText = "Anyone can guess your text";
            } else {
                const authorName = targetPlayer?.profiles?.username || 'Author';
                if (targetPlayerHasLeft) {
                    placeholderText = `${authorName} left! Free for all to guess!`;
                } else {
                    placeholderText = `Guess ${authorName}'s text!`;
                }
            }
        } else if (isMyTurn) {
            placeholderText = `It's your word! You have ${solvingTimeLeft}s to reveal it!`;
        } else {
            placeholderText = `${targetPlayer?.profiles?.username || 'Author'} is revealing their word... (${solvingTimeLeft}s)`;
        }
    } else {
        if (isMyTurn) {
            placeholderText = "It's your turn!";
        } else {
            placeholderText = `It is ${targetPlayer?.profiles?.username || 'someone else'}'s turn`;
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
    const isMaxHints = currentLevel >= 3;
    const wordValue = targetMessage ? calculateMessageValue(targetMessage.content) : 0;

    let nextCost = 0;
    let nextLabel = "";
    let buttonText: React.ReactNode = "1ˢᵗ";

    if (currentLevel === 0) {
        nextCost = Math.ceil(wordValue * HINT_COSTS.TIER_1); // 10%
        nextLabel = "Reveal Length";
        buttonText = "1ˢᵗ";
    } else if (currentLevel === 1) {
        nextCost = Math.ceil(wordValue * HINT_COSTS.TIER_2); // 10%
        nextLabel = "Reveal 1st + 25%";
        buttonText = <Shuffle className="h-3 w-3" />;
    } else if (currentLevel === 2) {
        nextCost = Math.ceil(wordValue * HINT_COSTS.TIER_3); // 40%
        nextLabel = "AI Hint";
        buttonText = "AI";
    }

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

    const HintButton = (
        <button
            type="button"
            disabled={(!isMyTurn && !isFreeForAll) || sending}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
                e.preventDefault();
                handleInteraction();
                onGetHint();
            }}
            onContextMenu={(e) => {
                // Mobile long press simulation
                e.preventDefault();
            }}
            className="h-10 w-10 flex flex-col items-center justify-center rounded-lg transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <span className="text-sm leading-none mb-0.5">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "💡"}
            </span>
            <span className="text-[10px] font-bold leading-none">{buttonText}</span>
        </button>
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
            title="Give Up"
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
                <form onSubmit={onSendMessage} className="flex gap-2 items-center relative">
                    <AnimatePresence>
                        {game.status === 'solving' && isFreeForAll && !isSinglePlayer && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute -top-3 right-14 z-10"
                            >
                                <Badge variant="subtle" className="shadow-sm">
                                    FREE FOR ALL
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
                                            <p className="text-muted-foreground">Cost: <span className="text-red-500 dark:text-red-400">-{nextCost} pts</span></p>
                                            <p className="text-[10px] text-muted-foreground opacity-70">Deducted from word value</p>
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

                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val.length > GAME_CONFIG.MESSAGE_MAX_LENGTH) {
                                    toast.error(`Message cannot exceed ${GAME_CONFIG.MESSAGE_MAX_LENGTH} characters`);
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
                            className={`h-10 w-full px-3 py-2 pr-14 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:border-blue-500 outline-none transition-colors ${game.status === 'solving' ? 'border-purple-500' : ''} ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        {/* Character Counter */}
                        {(input.length > 0 || (game.status === 'solving' && targetMessage && (isSinglePlayer || currentLevel >= 1))) && (
                            <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium select-none pointer-events-none transition-colors ${targetMessage && input.length > targetMessage.content.length
                                ? 'text-red-500 dark:text-red-400'
                                : 'text-gray-400 dark:text-gray-500'
                                }`}>
                                {input.length}
                                {(isSinglePlayer || currentLevel >= 1) && targetMessage && (
                                    <span className="opacity-70"> / {targetMessage.content.length}</span>
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
                        {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 ml-0.5" />}
                    </button>
                </form>
            </TooltipProvider>
        </div>
    );
}
