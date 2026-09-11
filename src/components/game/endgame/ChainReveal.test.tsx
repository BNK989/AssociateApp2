import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

import { ChainReveal } from './ChainReveal';
import type { ShareSquare } from '@/lib/daily/dailyShare';

const WORDS = ['anchor', 'harbour', 'ship', 'ocean'];

function renderChain(squares: ShareSquare[]) {
    return render(<ChainReveal words={WORDS} squares={squares} theme="At sea" />);
}

describe('ChainReveal', () => {
    // The whole point of the reveal: the player who solved nothing is the one
    // who most needs a reason to come back, and withholding the chain takes
    // the payoff away from exactly them.
    it('shows every word even when the player solved none of them', () => {
        renderChain(['missed', 'missed', 'missed']);

        for (const word of WORDS) {
            expect(screen.getByText(word)).toBeTruthy();
        }
    });

    it('shows the theme beside the chain it explains', () => {
        renderChain(['clean', 'clean', 'clean']);
        expect(screen.getByText('At sea')).toBeTruthy();
    });

    it('renders nothing at all for an empty chain', () => {
        const { container } = render(<ChainReveal words={[]} squares={[]} />);
        expect(container.firstChild).toBeNull();
    });

    // The starting word has no square because nobody guessed it. Falling
    // through to the `missed` grey would mark the one word that could not be
    // got wrong as a failure.
    it('does not dress the free starting word as a miss', () => {
        renderChain(['clean', 'clean', 'clean']);

        const startWord = screen.getByText('ocean');
        const missStyled = screen.getByText('anchor').className;

        expect(startWord.className).not.toEqual(missStyled);
        expect(startWord.className).toContain('border-dashed');
    });
});
