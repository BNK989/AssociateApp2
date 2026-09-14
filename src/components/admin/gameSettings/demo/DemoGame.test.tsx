import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { DEFAULT_HINT_POLICY } from '@/lib/daily/hintPolicy';
import { DEFAULT_FEEDBACK_POLICY } from '@/lib/daily/feedbackPolicy';
import { DEFAULT_LETTER_POOL_POLICY } from '@/lib/daily/letterPoolPolicy';
import { DEFAULT_SETTLE_POLICY } from '@/lib/daily/settlePolicy';
import { DemoGame } from './DemoGame';
import type { DemoPolicies } from './demoPolicies';

// The board mounts the shipped composer, which is translated. Every test in
// this codebase answers `useTranslations` with the key itself rather than
// standing a provider up, so the panel is asserted on by its own English
// chrome and never on a translated string.
vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

afterEach(() => cleanup());

const POLICIES: DemoPolicies = {
    hint: {
        ...DEFAULT_HINT_POLICY,
        startLevel: 2,
        startLevelAppliesTo: 'every-word-on-arrival',
        // Off so the panel is not racing a countdown while it is being asserted on.
        autoEnabled: false,
    },
    feedback: DEFAULT_FEEDBACK_POLICY,
    letterPool: DEFAULT_LETTER_POOL_POLICY,
    settle: DEFAULT_SETTLE_POLICY,
};

/**
 * The rules the demo plays by are tested in `useDemoGame.test.ts`. What is left
 * for the panel itself is that the real board mounts under it and stays
 * drivable: it renders the shipped composer, the shipped ladder and the
 * game-master controls, all of which are wired through enough props that a
 * broken one shows up as a missing control rather than as a type error.
 */
describe('DemoGame', () => {
    it('renders the board with the game master controls around it', () => {
        render(<DemoGame policies={POLICIES} />);

        expect(screen.getByRole('button', { name: 'Fill the answer' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Hint' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Give up' })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Restart the demo/ })).toBeTruthy();
    });

    it('shows one row per word of the chain', () => {
        const { container } = render(<DemoGame policies={POLICIES} />);
        expect(container.querySelectorAll('li')).toHaveLength(4);
    });

    it('reports the score and that no automatic hint is coming', () => {
        render(<DemoGame policies={POLICIES} />);

        expect(screen.getByText('Score')).toBeTruthy();
        expect(screen.getByText('no automatic hint coming')).toBeTruthy();
    });

    // The whole point of the skip control: the stuck ladder is on a twenty
    // second clock, and a game master composing the fork should not have to
    // sit through it to see what they just composed.
    it('credits the stuck ladder with dwell when the clock is pushed forward', () => {
        render(<DemoGame policies={POLICIES} />);

        expect(screen.queryByText(/dwell credited on this word/)).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: /Skip 10s ahead/ }));
        expect(screen.getByText('10s of dwell credited on this word')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: /Skip 10s ahead/ }));
        expect(screen.getByText('20s of dwell credited on this word')).toBeTruthy();
    });
});
