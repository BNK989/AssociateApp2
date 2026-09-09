import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useShareApp } from './useShareApp';

const capture = vi.fn();
vi.mock('posthog-js/react', () => ({
    usePostHog: () => ({ capture: (...args: unknown[]) => capture(...args) }),
}));

// Translations are exercised for real elsewhere; here the key is the assertion.
vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

const success = vi.fn();
const failure = vi.fn();
vi.mock('sonner', () => ({
    toast: {
        success: (...args: unknown[]) => success(...args),
        error: (...args: unknown[]) => failure(...args),
    },
}));

const copyToClipboard = vi.fn(async () => true);
vi.mock('@/lib/utils', () => ({
    getURL: (path: string) => `https://associ8.app${path}`,
    copyToClipboard: (text: string) => copyToClipboard(text),
    cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

function Harness() {
    const { share, sharing } = useShareApp('lobby_card');
    return (
        <button onClick={share} data-testid="share">
            {sharing ? 'sharing' : 'idle'}
        </button>
    );
}

async function clickShare() {
    await act(async () => {
        screen.getByTestId('share').click();
    });
}

const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share');

function setNativeShare(impl: ((data: ShareData) => Promise<void>) | undefined) {
    Object.defineProperty(navigator, 'share', {
        value: impl,
        configurable: true,
        writable: true,
    });
}

describe('useShareApp', () => {
    beforeEach(() => {
        capture.mockClear();
        success.mockClear();
        failure.mockClear();
        copyToClipboard.mockClear();
        copyToClipboard.mockResolvedValue(true);
    });

    afterEach(() => {
        if (originalShare) Object.defineProperty(navigator, 'share', originalShare);
        else Reflect.deleteProperty(navigator, 'share');
    });

    it('opens the native share sheet with a link tagged by surface', async () => {
        const nativeShare = vi.fn(async () => undefined);
        setNativeShare(nativeShare);

        render(<Harness />);
        await clickShare();

        expect(nativeShare).toHaveBeenCalledWith({
            title: 'title',
            text: 'message',
            url: 'https://associ8.app/?ref=lobby_card',
        });
        expect(copyToClipboard).not.toHaveBeenCalled();
        expect(capture).toHaveBeenCalledWith('app_shared', { surface: 'lobby_card', method: 'native' });
    });

    it('copies the pitch and the link where there is no share sheet', async () => {
        setNativeShare(undefined);

        render(<Harness />);
        await clickShare();

        expect(copyToClipboard).toHaveBeenCalledWith('message\n\nhttps://associ8.app/?ref=lobby_card');
        expect(success).toHaveBeenCalledWith('toasts.copied');
        expect(capture).toHaveBeenCalledWith('app_shared', { surface: 'lobby_card', method: 'clipboard' });
    });

    it('stays silent when the player closes the sheet', async () => {
        const abort = new Error('share canceled');
        abort.name = 'AbortError';
        setNativeShare(vi.fn(async () => { throw abort; }));

        render(<Harness />);
        await clickShare();

        // A dismissal is a decision, not a failure: no clipboard, no toast.
        expect(copyToClipboard).not.toHaveBeenCalled();
        expect(success).not.toHaveBeenCalled();
        expect(failure).not.toHaveBeenCalled();
        expect(capture).toHaveBeenCalledWith('app_share_dismissed', { surface: 'lobby_card' });
    });

    it('falls back to the clipboard when the sheet itself fails', async () => {
        const denied = new Error('Permission denied');
        denied.name = 'NotAllowedError';
        setNativeShare(vi.fn(async () => { throw denied; }));

        render(<Harness />);
        await clickShare();

        expect(copyToClipboard).toHaveBeenCalledOnce();
        expect(success).toHaveBeenCalledWith('toasts.copied');
    });

    it('tells the player when even the clipboard is unavailable', async () => {
        setNativeShare(undefined);
        copyToClipboard.mockResolvedValue(false);

        render(<Harness />);
        await clickShare();

        expect(failure).toHaveBeenCalledWith('toasts.failed');
        expect(capture).not.toHaveBeenCalled();
    });

    it('unlocks the button once the share settles', async () => {
        setNativeShare(vi.fn(async () => undefined));

        render(<Harness />);
        await clickShare();

        expect(screen.getByTestId('share').textContent).toBe('idle');
    });
});
