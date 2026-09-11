import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
    useTranslations: () => (key: string, values?: Record<string, unknown>) =>
        values ? `${key}:${JSON.stringify(values)}` : key,
}));

import { StuckOffer } from './StuckOffer';

const noop = () => {};

describe('StuckOffer', () => {
    it('renders nothing while the game has nothing to say', () => {
        const { container } = render(
            <StuckOffer offer={null} onAct={noop} onDismiss={noop} />,
        );
        expect(container.firstChild).toBeNull();
    });

    // A stake is a reason to keep going, not a route out, so it carries no
    // action — offering an escape to someone who has not asked for one is the
    // suggestion that they are failing.
    it('gives the opening nudge no action button', () => {
        render(
            <StuckOffer
                offer={{ kind: 'stake', solvesToBonus: 3, wordsLeft: 4 }}
                onAct={noop}
                onDismiss={noop}
            />,
        );

        expect(screen.getAllByRole('button')).toHaveLength(1); // dismiss only
    });

    it('mentions the bonus only when it is close enough to be a reason', () => {
        const { rerender } = render(
            <StuckOffer
                offer={{ kind: 'stake', solvesToBonus: 1, wordsLeft: 4 }}
                onAct={noop}
                onDismiss={noop}
            />,
        );
        expect(screen.getByText(/stake_bonus/)).toBeTruthy();

        rerender(
            <StuckOffer
                offer={{ kind: 'stake', solvesToBonus: 3, wordsLeft: 4 }}
                onAct={noop}
                onDismiss={noop}
            />,
        );
        expect(screen.getByText(/stake_words/)).toBeTruthy();
    });

    it('hands back the offer it was showing when the action is taken', async () => {
        const onAct = vi.fn();
        render(<StuckOffer offer={{ kind: 'other_end' }} onAct={onAct} onDismiss={noop} />);

        screen.getByText(/other_end_action/).closest('button')!.click();

        expect(onAct).toHaveBeenCalledWith('other_end');
    });

    it('can always be waved away', () => {
        const onDismiss = vi.fn();
        render(<StuckOffer offer={{ kind: 'letter' }} onAct={noop} onDismiss={onDismiss} />);

        screen.getByLabelText('dismiss').click();

        expect(onDismiss).toHaveBeenCalled();
    });
});
