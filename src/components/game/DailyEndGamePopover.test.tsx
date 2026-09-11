import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./endgame/useEndGameConfetti', () => ({ useEndGameConfetti: () => {} }));

import { DailyEndGamePopover } from './DailyEndGamePopover';
import type { ChainOutcome } from '@/lib/daily/endOutcome';
import type { ShareSquare } from '@/lib/daily/dailyShare';

const outcome: ChainOutcome = { tier: 'partial', solved: 2, total: 4, celebrate: false };
const squares: ShareSquare[] = ['clean', 'hinted', 'missed', 'missed'];

function renderScreen(overrides: Partial<Parameters<typeof DailyEndGamePopover>[0]> = {}) {
    return render(
        <DailyEndGamePopover
            open
            score={35}
            outcome={outcome}
            squares={squares}
            shareText="grid"
            streak={null}
            isGuest
            words={['anchor', 'harbour', 'ship', 'ocean', 'salt']}
            onClose={() => {}}
            {...overrides}
        />,
    );
}

describe('DailyEndGamePopover', () => {
    it('always offers a way out of the summary', () => {
        renderScreen();

        expect(screen.getByText('share_btn')).toBeTruthy();
        expect(screen.getByText('home_btn')).toBeTruthy();
    });

    /**
     * The summary grew past the viewport when the chain reveal landed, and the
     * dialog primitive centres itself with no maximum height — so the footer
     * and the close button went off-screen together and the player was stuck.
     * The cap and the scrolling body are what keep the buttons above reachable.
     */
    it('caps its height and scrolls the middle rather than the page', () => {
        const { container } = renderScreen();

        const content = container.ownerDocument.querySelector('[data-slot="dialog-content"]')!;
        expect(content.className).toContain('max-h-[90dvh]');
        expect(content.querySelector('.overflow-y-auto')).toBeTruthy();
    });

    it('invites a guest to make an account', () => {
        renderScreen();
        expect(screen.queryByText('upsell_title')).toBeTruthy();
    });

    it('does not invite a signed-in player to make the account they have', () => {
        renderScreen({ isGuest: false });
        expect(screen.queryByText('upsell_title')).toBeNull();
    });

    it('shows the chain to a player who solved almost none of it', () => {
        renderScreen({
            outcome: { tier: 'blank', solved: 0, total: 4, celebrate: false },
            squares: ['missed', 'missed', 'missed', 'missed'],
        });

        expect(screen.getByText('ocean')).toBeTruthy();
    });
});
