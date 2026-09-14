import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
    useTranslations: () => (key: string, values?: Record<string, unknown>) =>
        values ? `${key}:${JSON.stringify(values)}` : key,
}));

// Real framer would hold an exiting node on screen for the length of its
// animation, which makes "has it gone yet" untestable. The phases are the
// subject here, not the fade between them.
type MockProps = { children?: ReactNode; className?: string; [key: string]: unknown };
vi.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: MockProps) => <>{children}</>,
    motion: {
        div: ({ children, className, role }: MockProps & { role?: string }) => (
            <div className={className} role={role}>{children}</div>
        ),
        button: ({ children, className, onClick, ...rest }: MockProps & { onClick?: () => void }) => (
            <button
                className={className}
                onClick={onClick}
                aria-label={rest['aria-label'] as string | undefined}
                title={rest.title as string | undefined}
            >
                {children}
            </button>
        ),
    },
}));

import { COLLAPSE_AFTER_MS, TRANSIENT_HOLD_MS } from '@/lib/daily/offerPresentation';
import { StuckOffer } from './StuckOffer';

const noop = () => {};

const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('StuckOffer', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

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

    /**
     * The offer must not take part in the column's layout.
     *
     * Mounted as a flow sibling of the composer it appeared from nothing and
     * pushed the whole board upward mid-word, which reads as the page breaking
     * rather than as the game offering something. Anchored to the top edge of
     * the input row it costs no height at all.
     */
    it('floats above the composer instead of displacing the board', () => {
        const { container } = render(
            <StuckOffer offer={{ kind: 'other_end' }} onAct={noop} onDismiss={noop} />,
        );

        const card = container.querySelector('[role="status"]')!;
        expect(card.className).toContain('absolute');
        expect(card.className).toContain('bottom-full');
    });

    it('can always be waved away', () => {
        const onDismiss = vi.fn();
        render(<StuckOffer offer={{ kind: 'letter' }} onAct={noop} onDismiss={onDismiss} />);

        screen.getByLabelText('dismiss').click();

        expect(onDismiss).toHaveBeenCalled();
    });
});

/**
 * A remark is read once and is then clutter; a route out has to outlive the
 * thought it interrupted. That difference is the whole point of the phases.
 */
describe('StuckOffer — staying out of the way', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('takes a remark away once it has been read', () => {
        const { container } = render(
            <StuckOffer
                offer={{ kind: 'stake', solvesToBonus: 3, wordsLeft: 3 }}
                onAct={noop}
                onDismiss={noop}
            />,
        );

        expect(screen.getByText(/stake_words/)).toBeTruthy();

        wait(TRANSIENT_HOLD_MS);

        expect(container.firstChild).toBeNull();
    });

    it('leaves an actionable offer parked aside rather than closing it', () => {
        render(<StuckOffer offer={{ kind: 'other_end' }} onAct={noop} onDismiss={noop} />);

        wait(COLLAPSE_AFTER_MS);

        expect(screen.queryByText(/other_end_title/)).toBeNull();
        expect(screen.getByLabelText('reopen')).toBeTruthy();
    });

    // The chip is small enough to be brushed by a thumb, and one of the actions
    // behind it spends the word. Reopening must never be the action itself.
    it('reopens the offer rather than firing it', () => {
        const onAct = vi.fn();
        const onReopen = vi.fn();
        render(
            <StuckOffer
                offer={{ kind: 'reveal' }}
                onAct={onAct}
                onDismiss={noop}
                onReopen={onReopen}
            />,
        );

        wait(COLLAPSE_AFTER_MS);
        act(() => screen.getByLabelText('reopen').click());

        expect(onAct).not.toHaveBeenCalled();
        expect(onReopen).toHaveBeenCalled();
        expect(screen.getByText(/reveal_title/)).toBeTruthy();
    });

    // Having asked for it back, the player should not have to chase it again.
    it('keeps a reopened offer open', () => {
        render(<StuckOffer offer={{ kind: 'letter' }} onAct={noop} onDismiss={noop} />);

        wait(COLLAPSE_AFTER_MS);
        act(() => screen.getByLabelText('reopen').click());
        wait(COLLAPSE_AFTER_MS * 2);

        expect(screen.getByText(/letter_title/)).toBeTruthy();
    });

    // The offer escalates on the same word: a faded stake is replaced by a route
    // out seconds later, and that one has not had its turn yet.
    it('gives the offer that replaces it a fresh turn at full width', () => {
        const { rerender } = render(
            <StuckOffer
                offer={{ kind: 'stake', solvesToBonus: 3, wordsLeft: 3 }}
                onAct={noop}
                onDismiss={noop}
            />,
        );

        wait(TRANSIENT_HOLD_MS);
        rerender(<StuckOffer offer={{ kind: 'other_end' }} onAct={noop} onDismiss={noop} />);

        expect(screen.getByText(/other_end_title/)).toBeTruthy();
    });
});

/**
 * The fork at hint level 2. The written clue and the loose letters walking
 * into place are both still there afterwards; the choice is only which comes
 * first, and the player makes it.
 */
describe('StuckOffer — the choice at hint level 2', () => {
    const choice = { kind: 'choice', lettersLeft: 3 } as const;

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('puts both routes in front of the player, and a way to wave them off', () => {
        render(<StuckOffer offer={choice} onAct={noop} onDismiss={noop} />);

        expect(screen.getByText(/^choice_title/)).toBeTruthy();
        expect(screen.getAllByRole('button')).toHaveLength(3); // clue, place, dismiss
    });

    it('says which route was taken', () => {
        const onAct = vi.fn();
        render(<StuckOffer offer={choice} onAct={onAct} onDismiss={noop} />);

        screen.getByText(/choice_clue/).closest('button')!.click();
        screen.getByText(/choice_place/).closest('button')!.click();

        expect(onAct.mock.calls).toEqual([['clue'], ['place']]);
    });

    // The quote is a game-master switch. Off, the two routes stand alone.
    it('quotes a price only when handed one', () => {
        const { rerender } = render(<StuckOffer offer={choice} onAct={noop} onDismiss={noop} />);
        expect(screen.queryByText(/price/)).toBeNull();

        rerender(
            <StuckOffer offer={choice} onAct={noop} onDismiss={noop} prices={{ clue: 2, place: 1 }} />,
        );
        expect(screen.getByText(/^price:\{"points":2\}/)).toBeTruthy();
        expect(screen.getByText(/^price_each:\{"points":1\}/)).toBeTruthy();
    });

    // The chip carries the bar's sentence as its tooltip. It used to format the
    // key bare, which for a counted title threw on every render of the chip.
    it('keeps a counted title whole when it steps aside to a chip', () => {
        const settle = { kind: 'settle', lettersLeft: 3 } as const;
        render(<StuckOffer offer={settle} onAct={noop} onDismiss={noop} />);
        wait(COLLAPSE_AFTER_MS);

        expect(screen.getByLabelText('reopen').getAttribute('title')).toBe('settle_title:{"count":3}');
    });

    // "0 pts" reads as a bug, not as generosity.
    it('says nothing about a free fork', () => {
        render(
            <StuckOffer offer={choice} onAct={noop} onDismiss={noop} prices={{ clue: 0, place: 1 }} />,
        );
        expect(screen.queryByText(/^price:/)).toBeNull();
        expect(screen.getByText(/^price_each:/)).toBeTruthy();
    });
});
