import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineLegend } from './InlineLegend';
import type { LegendSamples } from './legendRules';

/** Stands in for the tiles of the word the key is opened on. */
const SAMPLES: LegendSamples = { placed: 'T', present: 'a', unknown: '⊗' };

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

vi.mock('lucide-react', () => ({ X: () => <div data-testid="x-icon" /> }));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, onClick, className }: {
            children?: React.ReactNode;
            onClick?: React.MouseEventHandler;
            className?: string;
        }) => <div onClick={onClick} className={className}>{children}</div>,
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

describe('InlineLegend', () => {
    it('renders nothing while closed', () => {
        render(<InlineLegend open={false} samples={SAMPLES} positionNote="ordered" onDismiss={() => { }} />);
        expect(screen.queryByText('placed_short')).toBeNull();
    });

    it('carries its heading as a label, since the visible one costs a bubble row', () => {
        render(<InlineLegend open samples={SAMPLES} positionNote="ordered" onDismiss={() => { }} />);
        expect(screen.getByRole('note', { name: 'title' })).toBeTruthy();
        expect(screen.queryByText('title')).toBeNull();
    });

    it('shows the three states in their short form', () => {
        render(<InlineLegend open samples={SAMPLES} positionNote="ordered" onDismiss={() => { }} />);
        expect(screen.getByText('placed_short')).toBeTruthy();
        expect(screen.getByText('present_short')).toBeTruthy();
        expect(screen.getByText('unknown_short')).toBeTruthy();
    });

    it('states only the position rule that currently applies', () => {
        const { rerender } = render(<InlineLegend open samples={SAMPLES} positionNote="ordered" onDismiss={() => { }} />);
        expect(screen.getByText('ordered_note_short')).toBeTruthy();
        expect(screen.queryByText('shuffled_note_short')).toBeNull();

        rerender(<InlineLegend open samples={SAMPLES} positionNote="shuffled" onDismiss={() => { }} />);
        expect(screen.getByText('shuffled_note_short')).toBeTruthy();
        expect(screen.queryByText('ordered_note_short')).toBeNull();
    });

    it('uses the short notes, never the full ones, inside a bubble', () => {
        const { rerender } = render(<InlineLegend open samples={SAMPLES} positionNote="shuffled" onDismiss={() => { }} />);
        expect(screen.queryByText('shuffled_note')).toBeNull();

        rerender(<InlineLegend open samples={SAMPLES} positionNote="ordered" onDismiss={() => { }} />);
        expect(screen.queryByText('ordered_note')).toBeNull();
    });

    it('dismisses on the close button', () => {
        const onDismiss = vi.fn();
        render(<InlineLegend open samples={SAMPLES} positionNote="ordered" onDismiss={onDismiss} />);
        fireEvent.click(screen.getByLabelText('dismiss'));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('swallows taps so reading the key cannot re-scramble the word', () => {
        const onBubbleClick = vi.fn();
        render(
            <div onClick={onBubbleClick}>
                <InlineLegend open samples={SAMPLES} positionNote="ordered" onDismiss={() => { }} />
            </div>,
        );
        fireEvent.click(screen.getByText('placed_short'));
        expect(onBubbleClick).not.toHaveBeenCalled();
    });

    it("draws the samples from the word's own tiles", () => {
        render(<InlineLegend open samples={SAMPLES} positionNote="ordered" onDismiss={() => { }} />);
        expect(screen.getByText('T')).toBeTruthy();
        expect(screen.getByText('a')).toBeTruthy();
        expect(screen.getByText('⊗')).toBeTruthy();
    });
});
