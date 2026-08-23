import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { DEFAULT_HINT_POLICY, type DailyHintPolicy } from '@/lib/daily/hintPolicy';
import { DemoGame } from './DemoGame';

afterEach(() => cleanup());

const POLICY: DailyHintPolicy = {
    ...DEFAULT_HINT_POLICY,
    startLevel: 2,
    startLevelAppliesTo: 'every-word-on-arrival',
    // Off so the panel is not racing a countdown while it is being asserted on.
    autoEnabled: false,
};

/**
 * The rules the demo plays by are tested in `useDemoGame.test.ts`. What is left
 * for the panel itself is that it mounts and stays playable — it renders the
 * real `CipherText`, which is animation-heavy enough that a broken prop shows up
 * as a blank board rather than as a type error.
 */
describe('DemoGame', () => {
    it('renders a playable board', () => {
        render(<DemoGame policy={POLICY} />);

        expect(screen.getByLabelText('Demo guess')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Guess' })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Hint/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Restart the demo/ })).toBeTruthy();
    });

    it('shows one row per word of the chain', () => {
        const { container } = render(<DemoGame policy={POLICY} />);
        expect(container.querySelectorAll('li')).toHaveLength(4);
    });

    it('reports the score and that no automatic hint is coming', () => {
        render(<DemoGame policy={POLICY} />);

        expect(screen.getByText('Score')).toBeTruthy();
        expect(screen.getByText('no automatic hint coming')).toBeTruthy();
    });
});
