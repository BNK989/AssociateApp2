import { GameState, Player, Message } from '@/hooks/useGameLogic';

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
            placeholderText = "Free for all! Guess the word!";
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

    // Determine if Input is Disabled
    const isInputDisabled = sending || (
        game.status === 'solving'
            ? (!isFreeForAll && !isMyTurn)
            : !isMyTurn
    );

    return (
        <div className="p-4 border-t border-gray-800 bg-gray-900">
            <form onSubmit={onSendMessage} className="flex gap-2">
                {game.status === 'solving' && (
                    <button
                        type="button"
                        onClick={onGetHint}
                        className="p-3 rounded bg-yellow-600 hover:bg-yellow-700 text-white"
                        title="Get Hint"
                    >
                        💡
                    </button>
                )}
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isInputDisabled}
                    placeholder={placeholderText}
                    className={`flex-1 p-3 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none ${game.status === 'solving' ? 'border-purple-500' : ''} ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
                <button
                    type="submit"
                    disabled={isInputDisabled}
                    className={`p-3 rounded text-white font-bold ${game.status === 'solving' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {sending ? '...' : (game.status === 'solving' ? 'Guess' : 'Send')}
                </button>
            </form>
        </div>
    );
}
