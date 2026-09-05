import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { PlainTextField } from './PlainTextField';

/** Types into the contenteditable the way a browser does: mutate, then fire input. */
function type(el: HTMLElement, text: string) {
    el.textContent = text;
    fireEvent.input(el);
}

function Harness({
    initial = '',
    maxLength,
    onOverflow,
}: { initial?: string; maxLength?: number; onOverflow?: () => void }) {
    const [value, setValue] = useState(initial);
    return (
        <>
            <PlainTextField
                value={value}
                placeholder="Guess the word..."
                maxLength={maxLength}
                onOverflow={onOverflow}
                onChange={setValue}
            />
            <button onClick={() => setValue('')}>send</button>
        </>
    );
}

describe('PlainTextField', () => {
    it('exposes a textbox role so it reads as a text field', () => {
        render(<Harness />);
        const field = screen.getByRole('textbox');
        expect(field.getAttribute('contenteditable')).toBe('true');
        expect(field.tagName).toBe('DIV');
    });

    it('is not a form control, so Android never offers autofill for it', () => {
        const { container } = render(<Harness />);
        expect(container.querySelector('input')).toBeNull();
        expect(container.querySelector('textarea')).toBeNull();
    });

    it('reports what was typed', () => {
        render(<Harness />);
        type(screen.getByRole('textbox'), 'teacup');
        expect(screen.getByRole('textbox').textContent).toBe('teacup');
    });

    it('shows the placeholder only while empty', () => {
        render(<Harness />);
        expect(screen.getAllByText('Guess the word...').length).toBeGreaterThan(0);
        type(screen.getByRole('textbox'), 'a');
        expect(screen.queryByText('Guess the word...')).toBeNull();
    });

    it('mirrors an externally cleared value back into the DOM', () => {
        render(<Harness />);
        const field = screen.getByRole('textbox');
        type(field, 'teacup');
        fireEvent.click(screen.getByText('send'));
        expect(field.textContent).toBe('');
    });

    it('rolls back an edit past the max length and reports the overflow', () => {
        const onOverflow = vi.fn();
        render(<Harness initial="abc" maxLength={4} onOverflow={onOverflow} />);
        const field = screen.getByRole('textbox');
        type(field, 'abcde');
        expect(onOverflow).toHaveBeenCalledTimes(1);
        expect(field.textContent).toBe('abc');
    });

    it('accepts an edit that lands exactly on the max length', () => {
        const onOverflow = vi.fn();
        render(<Harness initial="abc" maxLength={4} onOverflow={onOverflow} />);
        const field = screen.getByRole('textbox');
        type(field, 'abcd');
        expect(onOverflow).not.toHaveBeenCalled();
        expect(field.textContent).toBe('abcd');
    });

    it('reads a contenteditable non-breaking space as a plain one', () => {
        const onChange = vi.fn();
        render(<PlainTextField value="" placeholder="p" onChange={onChange} />);
        const field = screen.getByRole('textbox');
        field.textContent = 'tea ';
        fireEvent.input(field);
        expect(onChange).toHaveBeenCalledWith('tea ');
    });

    it('strips the stray <br> a browser leaves behind on the last delete', () => {
        render(<Harness initial="a" />);
        const field = screen.getByRole('textbox');
        field.innerHTML = '<br>';
        fireEvent.input(field);
        expect(field.innerHTML).toBe('');
    });

    it('pastes plain text only, collapsing line breaks', () => {
        render(<Harness />);
        const field = screen.getByRole('textbox');
        const execCommand = vi.fn();
        Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
        fireEvent.paste(field, {
            clipboardData: { getData: () => 'hot\nsteeped  drinks' },
        });
        expect(execCommand).toHaveBeenCalledWith('insertText', false, 'hot steeped drinks');
    });

    it('passes key presses to the caller so Enter can send', () => {
        const onKeyDown = vi.fn();
        render(<PlainTextField value="" placeholder="p" onChange={() => { }} onKeyDown={onKeyDown} />);
        fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
        expect(onKeyDown).toHaveBeenCalled();
    });
});
