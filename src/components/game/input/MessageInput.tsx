import { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { GAME_CONFIG } from '@/lib/gameConfig';
import type { GameState, Message } from '@/hooks/useGameLogic';
import { countMeaningfulChars } from './inputRules';
import { PlainTextField } from './PlainTextField';
import { SlotStrip } from './SlotStrip';
import type { SlotGroup } from '@/lib/letterPool/slotRules';

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
    /**
     * The slot strip's model. When present the field shows the answer's shape
     * instead of the raw text, and `typedValue` replaces `input` as what the
     * player is editing — in skip mode those are not the same string, because
     * the greens are given rather than typed.
     */
    strip?: {
        groups: SlotGroup[];
        longest: number;
        caretIndex: number | null;
        dir: 'ltr' | 'rtl';
        /** Pool ids still in the air; those cells stay blank until they land. */
        held?: Set<string>;
    } | null;
    typedValue?: string;
    onTypedChange?: (value: string) => void;
    /** What the strip would keep of a raw edit, so the field can roll back the rest. */
    normalizeTyped?: (raw: string) => string;
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
    strip = null,
    typedValue = '',
    onTypedChange,
    normalizeTyped,
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

    // With the strip up, the player edits the keystrokes and the parent holds
    // the assembled answer, so the two values are read from different places.
    const onStrip = Boolean(strip) && Boolean(onTypedChange);
    const fieldValue = onStrip ? typedValue : input;

    // A keystroke the strip has no room for is rolled back by the field, which
    // is correct but silent — and with the typed text transparent, silence
    // reads as a broken keyboard. One short shake is the whole feedback.
    const [rejected, setRejected] = useState(false);

    const typedCount = countMeaningfulChars(input);
    const targetCount = targetMessage ? countMeaningfulChars(targetMessage.content) : 0;
    const isOverLength = isSolving && Boolean(targetMessage) && typedCount > targetCount;

    // The counter existed to tell the player how long the answer was. The strip
    // says that natively, one cell per letter, so it stands down rather than
    // repeating itself — which is also how the strip costs no composer height.
    const showCounter = !onStrip
        && (input.length > 0 || (isSolving && Boolean(targetMessage) && showTargetLength));

    return (
        <div id="game-input-area" className="flex gap-2 flex-1">
            <div
                className={`relative flex-1 ${onStrip
                    ? `slot-strip-host rounded-lg border bg-gray-100 transition-colors dark:bg-gray-800 focus-within:border-blue-500 ${
                        isSolving ? 'border-purple-500' : 'border-gray-300 dark:border-gray-700'
                    }`
                    : ''}`}
            >
                <PlainTextField
                    id="chat_message_input"
                    fieldRef={inputRef}
                    value={fieldValue}
                    placeholder={placeholder}
                    maxLength={GAME_CONFIG.MESSAGE_MAX_LENGTH}
                    normalize={onStrip ? normalizeTyped : undefined}
                    onRejected={() => {
                        setRejected(true);
                        window.setTimeout(() => setRejected(false), 220);
                    }}
                    onOverflow={() =>
                        toast.error(t('toast_max_length', { max: GAME_CONFIG.MESSAGE_MAX_LENGTH }))
                    }
                    onChange={(value) => {
                        if (onStrip) onTypedChange!(value);
                        else setInput(value);
                        onInteract();
                        if (onTyping && value.length > 0) onTyping();
                    }}
                    onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        onSend(e as unknown as React.FormEvent);
                    }}
                    onFocus={onInteract}
                    className={onStrip
                        ? 'absolute inset-0 z-10 h-full w-full bg-transparent px-3 py-2 leading-6 text-transparent caret-transparent outline-none selection:bg-transparent focus-visible:ring-2 focus-visible:ring-ring rounded-lg'
                        : `h-10 w-full px-3 py-2 pe-14 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white leading-6 whitespace-pre overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:border-blue-500 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${isSolving ? 'border-purple-500' : ''}`}
                    placeholderClassName={`absolute start-3 end-14 top-1/2 -translate-y-1/2 truncate select-none pointer-events-none text-gray-500 dark:text-gray-400 ${onStrip ? 'hidden' : ''}`}
                />

                {strip && (
                    <SlotStrip
                        rejected={rejected}
                        groups={strip.groups}
                        longest={strip.longest}
                        caretIndex={strip.caretIndex}
                        dir={strip.dir}
                        held={strip.held}
                    />
                )}

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
