import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useLegendIntro } from './useLegendIntro';

const capture = vi.fn();
vi.mock('posthog-js/react', () => ({ usePostHog: () => ({ capture: (...args: unknown[]) => capture(...args) }) }));

function Harness({ active, guessCount = 0 }: { active: boolean; guessCount?: number }) {
    const { isOpen, dismiss } = useLegendIntro({ active, hintLevel: 1, guessCount });
    return (
        <>
            <span data-testid="state">{isOpen ? 'open' : 'closed'}</span>
            <button onClick={dismiss}>dismiss</button>
        </>
    );
}

const state = () => screen.getByTestId('state').textContent;

describe('useLegendIntro', () => {
    beforeEach(() => {
        localStorage.clear();
        capture.mockClear();
    });

    it('opens itself the first time a word shows colour', () => {
        render(<Harness active />);
        expect(state()).toBe('open');
        expect(capture).toHaveBeenCalledWith('legend_intro_shown', { hint_level: 1 });
    });

    it('stays shut while no word is showing colour', () => {
        render(<Harness active={false} />);
        expect(state()).toBe('closed');
        expect(capture).not.toHaveBeenCalled();
    });

    it('never opens a second time, on this or any later word', () => {
        const first = render(<Harness active />);
        expect(state()).toBe('open');
        first.unmount();

        render(<Harness active />);
        expect(state()).toBe('closed');
        expect(capture).toHaveBeenCalledTimes(1);
    });

    it('closes when the player dismisses it', () => {
        render(<Harness active />);
        fireEvent.click(screen.getByText('dismiss'));
        expect(state()).toBe('closed');
        expect(capture).toHaveBeenCalledWith('legend_intro_closed', { reason: 'dismissed' });
    });

    it('steps aside on the next guess', () => {
        const { rerender } = render(<Harness active guessCount={0} />);
        expect(state()).toBe('open');
        rerender(<Harness active guessCount={1} />);
        expect(state()).toBe('closed');
        expect(capture).toHaveBeenCalledWith('legend_intro_closed', { reason: 'guessed' });
    });

    it('closes when the word settles', () => {
        const { rerender } = render(<Harness active />);
        rerender(<Harness active={false} />);
        expect(state()).toBe('closed');
        expect(capture).toHaveBeenCalledWith('legend_intro_closed', { reason: 'word_settled' });
    });

    it('treats a storage that throws as already seen rather than failing', () => {
        const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied');
        });
        act(() => { render(<Harness active />); });
        expect(state()).toBe('closed');
        getItem.mockRestore();
    });
});
