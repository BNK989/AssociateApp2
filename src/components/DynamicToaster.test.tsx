import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { DynamicToaster } from './DynamicToaster';

const pathname = vi.fn<() => string | null>();
vi.mock('@/navigation', () => ({ usePathname: () => pathname() }));

/**
 * Stands in for sonner's `Toaster` so the assertions read the props this
 * component actually decides, rather than the markup sonner renders from them.
 */
const toasterProps = vi.fn();
vi.mock('@/components/ui/sonner', () => ({
    Toaster: (props: Record<string, unknown>) => {
        toasterProps(props);
        return null;
    },
}));

const positionFor = (path: string | null) => {
    pathname.mockReturnValue(path);
    render(<DynamicToaster />);
    return toasterProps.mock.calls.at(-1)?.[0] as { position: string };
};

describe('DynamicToaster', () => {
    beforeEach(() => {
        toasterProps.mockClear();
    });

    it('keeps toasts off the game header on the daily route', () => {
        // The regression this guards: `/daily` fell through to top-centre and
        // progress cues landed on the theme and the running score.
        expect(positionFor('/daily').position).toBe('bottom-center');
    });

    it('keeps toasts off the game header in a multiplayer room', () => {
        expect(positionFor('/game/abc-123').position).toBe('bottom-center');
    });

    it('clears the composer on a game route and nowhere else', () => {
        pathname.mockReturnValue('/daily');
        render(<DynamicToaster />);
        const game = toasterProps.mock.calls.at(-1)?.[0] as { toastOptions: { style?: object } };
        expect(game.toastOptions.style).toEqual({ marginBottom: '65px' });

        pathname.mockReturnValue('/');
        render(<DynamicToaster />);
        const site = toasterProps.mock.calls.at(-1)?.[0] as { toastOptions: { style?: object } };
        expect(site.toastOptions.style).toBeUndefined();
    });

    it('stays at the top on site pages', () => {
        expect(positionFor('/').position).toBe('top-center');
        expect(positionFor('/privacy').position).toBe('top-center');
    });

    it('survives a null pathname', () => {
        expect(positionFor(null).position).toBe('top-center');
    });
});
