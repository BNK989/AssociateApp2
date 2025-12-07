import { GameState, Player, Message } from '@/hooks/useGameLogic';
import { calculateMessageValue, HINT_COSTS } from '@/lib/gameLogic';
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Send, Loader2 } from "lucide-react";

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
    onGetHint
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
        game.status === 'solving'
            ? (!isFreeForAll && !isMyTurn)
            : !isMyTurn
    );

    // Hint Logic
    const currentLevel = targetMessage?.hint_level || 0;
    const isMaxHints = currentLevel >= 3;
    const wordValue = targetMessage ? calculateMessageValue(targetMessage.content) : 0;

    let nextCost = 0;
    let nextLabel = "";

    if (currentLevel === 0) {
        nextCost = Math.ceil(wordValue * HINT_COSTS.TIER_1); // 10%
        nextLabel = "Reaveal First Letter";
    } else if (currentLevel === 1) {
        nextCost = Math.ceil(wordValue * HINT_COSTS.TIER_2); // 10%
        nextLabel = "Reveal 40% Letters";
    } else if (currentLevel === 2) {
        nextCost = Math.ceil(wordValue * HINT_COSTS.TIER_3); // 40%
        nextLabel = "AI Hint";
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 z-20 max-w-md mx-auto p-2 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <form onSubmit={onSendMessage} className="flex gap-2 items-center">
                {game.status === 'solving' && targetMessage && (
                    <div className="relative group">
                        <button
                            type="button"
                            onClick={onGetHint}
                            disabled={isMaxHints}
                            className={`p-2 rounded text-white shrink-0 font-bold transition-all ${isMaxHints ? 'bg-gray-500 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700'}`}
                            title="Get Hint"
                        >
                            💡
                            {!isMaxHints && (
                                <span className="absolute -top-3 -right-3 bg-red-500 text-white text-[10px] px-1 rounded-full shadow-sm">
                                    -{nextCost} pts
                                </span>
                            )}
                        </button>
                        {!isMaxHints && (
                            <div className="absolute bottom-full left-0 mb-2 w-32 bg-black/80 text-white text-xs p-2 rounded hidden group-hover:block backdrop-blur-sm">
                                <p className="font-bold mb-1">{nextLabel}</p>
                                <p className="text-gray-300">Cost: {nextCost} pts</p>
                                <p className="text-[10px] opacity-70 mt-1">Deducted from word value</p>
                            </div>
                        )}
                    </div>
                )}
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isInputDisabled}
                    placeholder={placeholderText}
                    className={`flex-1 p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:border-blue-500 outline-none ${game.status === 'solving' ? 'border-purple-500' : ''} ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
                <button
                    type="submit"
                    disabled={isSubmitDisabled}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`w-10 h-10 flex items-center justify-center rounded-full text-white font-bold shrink-0 transition-colors ${game.status === 'solving' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'} ${isSubmitDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 ml-0.5" />}
                </button>
            </form>
        </div>
    );
}
