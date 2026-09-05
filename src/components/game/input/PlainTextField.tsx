import { useEffect, useRef } from 'react';

type PlainTextFieldProps = {
    id?: string;
    /** Optional handle on the editable node, for callers that focus it. */
    fieldRef?: React.RefObject<HTMLDivElement | null>;
    /** Controlled value. The DOM is re-synced whenever it drifts from this. */
    value: string;
    placeholder: string;
    /** Rejected when exceeded: the edit is rolled back and `onOverflow` fires. */
    maxLength?: number;
    className?: string;
    placeholderClassName?: string;
    onChange: (value: string) => void;
    onOverflow?: () => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
    onFocus?: () => void;
};

/**
 * A single-line text field built on `contenteditable` instead of `<input>`.
 *
 * WHY NOT AN INPUT: Chrome for Android reports every focused `<input>` to the
 * Android Autofill framework, which makes the keyboard draw an autofill strip
 * (passwords / cards / addresses) above its toolbar. That strip costs ~55px of
 * an already short mobile board, and `autocomplete="off"` does not suppress it —
 * it is the platform's row, not the page's. A `contenteditable` host is not a
 * form control, so Chrome never announces it as fillable and the strip stays
 * closed. Everything an `<input>` gave us for free is re-implemented below.
 *
 * Enter is the caller's to handle (`onKeyDown`); newlines never enter the value.
 */
export function PlainTextField({
    id,
    fieldRef,
    value,
    placeholder,
    maxLength,
    className = '',
    placeholderClassName = '',
    onChange,
    onOverflow,
    onKeyDown,
    onFocus,
}: PlainTextFieldProps) {
    const ownRef = useRef<HTMLDivElement>(null);
    const ref = fieldRef ?? ownRef;

    /**
     * Mirror the controlled value back into the DOM when the two drift apart —
     * a send clearing the field, a hint prefilling it. Typing does not drift
     * (the change handler reports exactly what the DOM holds), so the caret
     * survives normal input untouched.
     */
    useEffect(() => {
        const el = ref.current;
        if (!el || readText(el) === value) return;
        el.textContent = value;
        if (document.activeElement === el) moveCaretToEnd(el);
    }, [value, ref]);

    return (
        <>
            <div
                ref={ref}
                id={id}
                role="textbox"
                aria-multiline="false"
                aria-label={placeholder}
                contentEditable
                suppressContentEditableWarning
                tabIndex={0}
                inputMode="text"
                enterKeyHint="send"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                translate="no"
                onInput={() => {
                    const el = ref.current;
                    if (!el) return;
                    const text = readText(el);
                    if (maxLength !== undefined && text.length > maxLength) {
                        // Roll the rejected keystroke back to the last accepted value.
                        el.textContent = value;
                        moveCaretToEnd(el);
                        onOverflow?.();
                        return;
                    }
                    // Browsers leave a stray <br> behind on the last delete, which
                    // would keep the field non-empty and hide the placeholder.
                    if (text === '' && el.innerHTML !== '') el.innerHTML = '';
                    onChange(text);
                }}
                onPaste={(e) => {
                    // Paste plain text only: no markup, no line breaks.
                    e.preventDefault();
                    const text = e.clipboardData.getData('text/plain').replace(/\s+/g, ' ');
                    if (text) document.execCommand('insertText', false, text);
                }}
                onDrop={(e) => e.preventDefault()}
                onKeyDown={onKeyDown}
                onFocus={onFocus}
                className={className}
            />
            {value === '' && (
                <div aria-hidden className={placeholderClassName}>
                    {placeholder}
                </div>
            )}
        </>
    );
}

/**
 * The field's value as an `<input>` would report it. `contenteditable` stores a
 * trailing space as a non-breaking one, which would otherwise never compare
 * equal to the value we handed React and would re-sync on every keystroke.
 */
function readText(el: HTMLElement): string {
    return (el.textContent ?? '').replace(/\u00A0/g, ' ');
}

function moveCaretToEnd(el: HTMLElement) {
    const selection = window.getSelection?.();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}
