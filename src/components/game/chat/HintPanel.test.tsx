import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HintPanel } from './HintPanel';

const CLUE = 'A low, throaty sound.';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

vi.mock('lucide-react', () => ({
    ChevronDown: () => <div data-testid="chevron" />,
    Lightbulb: () => <div data-testid="bulb" />,
}));

vi.mock('framer-motion', () => ({
    useReducedMotion: () => false,
    motion: {
        div: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
            <div className={className}>{children}</div>,
        p: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
            <p className={className}>{children}</p>,
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

describe('HintPanel', () => {
    it('draws nothing for a word with no clue to show', () => {
        const { container } = render(<HintPanel display="none" hint={CLUE} />);

        expect(container.textContent).toBe('');
    });

    it('opens the clue on the word being played', () => {
        render(<HintPanel display="open" hint={CLUE} />);

        expect(screen.getByLabelText(CLUE)).toBeTruthy();
    });

    it('holds the place of a clue still on its way', () => {
        render(<HintPanel display="open" />);

        expect(screen.getByText('decoding_clue')).toBeTruthy();
    });

    it('grows the spacing with the panel rather than ahead of it', () => {
        const { container } = render(<HintPanel display="open" hint={CLUE} />);

        // The gap between the word and its clue sits inside the box that
        // animates open, so no margin appears before the panel has height.
        const clip = container.querySelector('.overflow-hidden');
        expect(clip).toBeTruthy();
        expect(clip?.querySelector('.pt-2')).toBeTruthy();
        expect(container.firstElementChild?.className).not.toContain('mt-2');
    });

    it('collapses a spent clue to a row that opens on demand', () => {
        render(<HintPanel display="collapsed" hint={CLUE} />);

        expect(screen.queryByText(CLUE)).toBeNull();

        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByText(CLUE)).toBeTruthy();
    });
});
