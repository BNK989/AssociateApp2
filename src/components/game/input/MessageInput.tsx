import { useEffect, useRef } from 'react';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { GAME_CONFIG } from '@/lib/gameConfig';
import type { GameState, Message } from '@/hooks/useGameLogic';
import { countMeaningfulChars } from './inputRules';
import { PlainTextField } from './PlainTextField';

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
    const inputRef = useRef<HTMLDivElement>(null);

    /**
     * Desktop players expect to type the moment a word comes up, and re-focus
     * after each solve so the chain never needs a click. Gated on a fine
     * pointer: on touch, focusing would throw the keyboard over the board.
     */
    const targetId = targetMessage?.id;
    useEffect(() => {
        if (typeof window === 'undefined') return;
        // Optional-called: jsdom and older embedded webviews have no matchMedia,
        // and there the pre-existing click-to-focus behaviour is the right one.
        if (!window.matchMedia?.('(pointer: fine)').matches) return;
        inputRef.current?.focus();
    }, [targetId]);

    const typedCount = countMeaningfulChars(input);
    const targetCount = targetMessage ? countMeaningfulChars(targetMessage.content) : 0;
    const isOverLength = isSolving && Boolean(targetMessage) && typedCount > targetCount;

    const showCounter = input.length > 0 || (isSolving && Boolean(targetMessage) && showTargetLength);

    return (
        <div id="game-input-area" className="flex gap-2 flex-1">
            <div className="relative flex-1">
                <PlainTextField
                    id="chat_message_input"
                    fieldRef={inputRef}
                    value={input}
                    placeholder={placeholder}
                    maxLength={GAME_CONFIG.MESSAGE_MAX_LENGTH}
                    onOverflow={() =>
                        toast.error(t('toast_max_length', { max: GAME_CONFIG.MESSAGE_MAX_LENGTH }))
                    }
                    onChange={(value) => {
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
                    className={`h-10 w-full px-3 py-2 pe-14 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white leading-6 whitespace-pre overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:border-blue-500 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${isSolving ? 'border-purple-500' : ''}`}
                    placeholderClassName="absolute start-3 end-14 top-1/2 -translate-y-1/2 truncate select-none pointer-events-none text-gray-500 dark:text-gray-400"
                />

                {showCounter && (
                    <div
                        data-testid="char-counter"
                        // Anchored to the field's edge and painted on its own
                        // background: the text now scrolls under the counter
                        // (a contenteditable clips at its padding box, an input did not).
                        className={`absolute end-px top-1/2 -translate-y-1/2 px-3 bg-gray-100 dark:bg-gray-800 text-xs font-medium select-none pointer-events-none transition-colors ${isOverLength
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
                className={`h-10 w-10 flex items-center justify-center rounded-lg text-white font-bold shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isSolving ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'} ${submitDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {sending
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <Send className="h-5 w-5 rtl:-scale-x-100" />}
            </button>
        </div>
    );
}
