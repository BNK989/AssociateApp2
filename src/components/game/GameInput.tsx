import { GameState, Player, Message } from '@/hooks/useGameLogic';
import { calculateMessageValue, HINT_COSTS } from '@/lib/gameLogic';
import { Send, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useState } from 'react';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { toast } from "sonner";

type GameInputProps = {
    game: GameState;
    user: any;
    players: Player[];
    input: string;
    setInput: (value: string) => void;
    sending: boolean;
    solvingTimeLeft: number | null;
    targetMessage?: Message;
    onSendMessage: (e: React.FormEvent) => void;
    onGetHint: () => void;
    isEmpty?: boolean;
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
    isEmpty = false
}: GameInputProps) {

    // Determine who has the "turn"
    let activePlayerId = game.current_turn_user_id;
    if (game.status === 'solving' && targetMessage) {
        activePlayerId = targetMessage.user_id;
    }

    const isMyTurn = activePlayerId === user?.id;
    const currentTurnPlayer = players.find(p => p.user_id === activePlayerId);
    const isFreeForAll = solvingTimeLeft === 0;

    // Determine Placeholder Text
    let placeholderText = "Type a message...";
    if (game.status === 'solving') {
        if (isFreeForAll) {
            if (isMyTurn) {
                placeholderText = "Free for all! Anyone can guess your text";
            } else {
                const authorName = currentTurnPlayer?.profiles?.username || 'Author';
                placeholderText = `Free for all! Guess ${authorName}'s text!`;
            }
        } else if (isMyTurn) {
            placeholderText = `It's your word! You have ${solvingTimeLeft}s to reveal it!`;
        } else {
            placeholderText = `${currentTurnPlayer?.profiles?.username || 'Author'} is revealing their word... (${solvingTimeLeft}s)`;
        }
    } else {
        if (isMyTurn) {
            placeholderText = "It's your turn!";
        } else {
            placeholderText = `It is ${currentTurnPlayer?.profiles?.username || 'someone else'}'s turn`;
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
    let buttonParams = { text: "1ˢᵗ" };

    if (currentLevel === 0) {
        nextCost = Math.ceil(wordValue * HINT_COSTS.TIER_1); // 10%
        nextLabel = "Reveal First Letter";
        buttonParams.text = "1ˢᵗ";
    } else if (currentLevel === 1) {
        nextCost = Math.ceil(wordValue * HINT_COSTS.TIER_2); // 10%
        nextLabel = "Reveal 40% Letters";
        buttonParams.text = "2ⁿᵈ";
    } else if (currentLevel === 2) {
        nextCost = Math.ceil(wordValue * HINT_COSTS.TIER_3); // 40%
        nextLabel = "AI Hint";
        buttonParams.text = "3ʳᵈ";
    }

    // Auto-show tooltip logic
    const [isTooltipOpen, setIsTooltipOpen] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);

    useEffect(() => {
        if (game.status !== 'solving' || !targetMessage || isMaxHints) return;

        const storageKey = `hint-tooltip-shown-${game.id}`;
        const hasShown = localStorage.getItem(storageKey);

        if (hasShown) return;

        const timer = setTimeout(() => {
            if (!hasInteracted) {
                setIsTooltipOpen(true);
                localStorage.setItem(storageKey, 'true');
            }
        }, 5000);

        return () => clearTimeout(timer);
    }, [game.status, targetMessage, isMaxHints, hasInteracted, game.id]);

    const handleInteraction = () => {
        if (!hasInteracted) {
            setHasInteracted(true);
            setIsTooltipOpen(false);
        }
    };

    return (
        <div
            className="shrink-0 z-20 w-full p-2 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
            onClick={handleInteraction}
            onTouchStart={handleInteraction}
        >
            <TooltipProvider>
                <form onSubmit={onSendMessage} className="flex gap-2 items-center">
                    {game.status === 'solving' && targetMessage && !isMaxHints && (
                        <Tooltip open={isTooltipOpen} onOpenChange={setIsTooltipOpen}>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleInteraction();
                                        onGetHint();
                                    }}
                                    onContextMenu={(e) => {
                                        // Mobile long press simulation (though native Tooltip usually handles touch long press nicely or click)
                                        // For now relying on default trigger behaviors + our auto show
                                    }}
                                    className="h-10 w-10 flex flex-col items-center justify-center rounded-lg transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <span className="text-sm leading-none mb-0.5">💡</span>
                                    <span className="text-[10px] font-bold leading-none">{buttonParams.text}</span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="start">
                                <div className="text-xs space-y-1">
                                    <p className="font-bold">{nextLabel}</p>
                                    <p className="text-muted-foreground">Cost: <span className="text-red-500 dark:text-red-400">-{nextCost} pts</span></p>
                                    <p className="text-[10px] text-muted-foreground opacity-70">Deducted from word value</p>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    )}

                    <input
                        type="text"
                        value={input}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val.length > GAME_CONFIG.MESSAGE_MAX_LENGTH) {
                                toast.error(`Message cannot exceed ${GAME_CONFIG.MESSAGE_MAX_LENGTH} characters`);
                                return;
                            }
                            setInput(val);
                            handleInteraction();
                        }}
                        onFocus={handleInteraction}
                        disabled={isInputDisabled}
                        placeholder={placeholderText}
                        className={`h-10 flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:border-blue-500 outline-none transition-colors ${game.status === 'solving' ? 'border-purple-500' : ''} ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />

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
