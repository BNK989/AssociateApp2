import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { GAME_CONFIG } from '@/lib/gameConfig';
import type { GameState, Message } from '@/hooks/useGameLogic';
import { countMeaningfulChars } from './inputRules';

type MessageInputProps = {
    game: GameState;
    input: string;
    setInput: (value: string) => void;
    sending: boolean;
    submitDisabled: boolean;
    placeholder: string;
    targetMessage?: Message;
    /** Show the target's length alongside the count, once the player has earned it. */
    showTargetLength: boolean;
    onSend: (e: React.FormEvent) => void;
    onTyping?: () => void;
    onInteract: () => void;
};

/**
 * The text field, its character counter, and the send button.
 *
 * The field is never disabled, even off-turn, because disabling it closes the
 * mobile keyboard and makes the game feel broken; the send button carries the
 * restriction instead.
 */
export function MessageInput({
    game,
    input,
    setInput,
    sending,
    submitDisabled,
    placeholder,
    targetMessage,
    showTargetLength,
    onSend,
    onTyping,
    onInteract,
}: MessageInputProps) {
    const t = useTranslations('GameRoom.Input');
    const isSolving = game.status === 'solving';

    const typedCount = countMeaningfulChars(input);
    const targetCount = targetMessage ? countMeaningfulChars(targetMessage.content) : 0;
    const isOverLength = isSolving && Boolean(targetMessage) && typedCount > targetCount;

    const showCounter = input.length > 0 || (isSolving && Boolean(targetMessage) && showTargetLength);

    return (
        <div id="game-input-area" className="flex gap-2 flex-1">
            <div className="relative flex-1">
                <input
                    id="chat_message_input"
                    name="chat_message_v1"
                    type="text"
                    inputMode="text"
                    enterKeyHint="send"
                    value={input}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    // Keep password managers out of a game input.
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    onChange={(e) => {
                        const value = e.target.value;
                        if (value.length > GAME_CONFIG.MESSAGE_MAX_LENGTH) {
                            toast.error(t('toast_max_length', { max: GAME_CONFIG.MESSAGE_MAX_LENGTH }));
                            return;
                        }
                        setInput(value);
                        onInteract();
                        if (onTyping && value.length > 0) onTyping();
                    }}
                    onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        onSend(e as unknown as React.FormEvent);
                    }}
                    onFocus={onInteract}
                    placeholder={placeholder}
                    className={`h-10 w-full px-3 py-2 pe-14 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:border-blue-500 outline-none transition-colors ${isSolving ? 'border-purple-500' : ''}`}
                />

                {showCounter && (
                    <div
                        data-testid="char-counter"
                        className={`absolute end-3 top-1/2 -translate-y-1/2 text-xs font-medium select-none pointer-events-none transition-colors ${isOverLength
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-gray-400 dark:text-gray-500'
                            }`}
                    >
                        {typedCount}
                        {showTargetLength && targetMessage && (
                            <span data-testid="char-total" className="opacity-70"> / {targetCount}</span>
                        )}
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={(e) => onSend(e as unknown as React.FormEvent)}
                disabled={submitDisabled}
                onMouseDown={(e) => e.preventDefault()}
                className={`h-10 w-10 flex items-center justify-center rounded-lg text-white font-bold shrink-0 transition-colors ${isSolving ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'} ${submitDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {sending
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <Send className="h-5 w-5 rtl:-scale-x-100" />}
            </button>
        </div>
    );
}
