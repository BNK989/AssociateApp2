import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Lightbulb } from 'lucide-react';

vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

import { WalkthroughPopover } from './WalkthroughPopover';
import type { WalkthroughStep } from './types';

const step: WalkthroughStep = {
    id: 'step-hint',
    targetId: 'hint-button-trigger',
    title: 'Help, when you want it',
    content: 'The lightbulb opens the ladder.',
    position: 'top',
    icon: Lightbulb,
};

function renderCard(overrides: Partial<Parameters<typeof WalkthroughPopover>[0]> = {}) {
    return render(
        <WalkthroughPopover
            step={step}
            targetRect={null}
            current={1}
            total={4}
            onNext={() => {}}
            onPrev={() => {}}
            onSkip={() => {}}
            {...overrides}
        />,
    );
}

describe('WalkthroughPopover', () => {
    it('names itself to assistive tech rather than being an anonymous box', () => {
        renderCard();

        const dialog = screen.getByRole('dialog');
        expect(dialog.getAttribute('aria-labelledby')).toBe('walkthrough-title-step-hint');
        expect(dialog.getAttribute('aria-describedby')).toBe('walkthrough-body-step-hint');
    });

    /**
     * The old card truncated its own title with `truncate`, which silently ate
     * the end of every German and Hebrew step title. Long copy wraps now.
     */
    it('lets a long title wrap instead of clipping it', () => {
        renderCard({ step: { ...step, title: 'Ein bemerkenswert langer Schritt-Titel für diese Tour' } });

        const heading = screen.getByRole('heading', { level: 2 });
        expect(heading.textContent).toBe('Ein bemerkenswert langer Schritt-Titel für diese Tour');
        expect(heading.className).not.toContain('truncate');
    });

    it('advances on the primary button and leaves on the close button', () => {
        const onNext = vi.fn();
        const onSkip = vi.fn();
        renderCard({ onNext, onSkip });

        screen.getByText('next').click();
        expect(onNext).toHaveBeenCalledOnce();

        screen.getByLabelText('skip').click();
        expect(onSkip).toHaveBeenCalledOnce();
    });

    it('offers no way back from the first step', () => {
        renderCard({ current: 0 });
        expect(screen.queryByText('back')).toBeNull();

        renderCard({ current: 2 });
        expect(screen.getByText('back')).toBeTruthy();
    });

    it('ends on the tour\'s own word when it has one', () => {
        renderCard({ current: 3, finishLabel: 'Play now' });
        expect(screen.getByText('Play now')).toBeTruthy();

        renderCard({ current: 3 });
        expect(screen.getByText('finish')).toBeTruthy();
    });

    it('shows one progress dot per step', () => {
        const { container } = renderCard({ total: 4 });

        // The dots are the only fixed-height pills in the footer.
        expect(container.querySelectorAll('span.h-1\\.5').length).toBe(4);
    });
});
