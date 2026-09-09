'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { usePostHog } from 'posthog-js/react';
import { getURL } from '@/lib/utils';
import { createLogger, getErrorMessage } from '@/lib/logger';
import {
    buildAppShareMessage,
    buildAppShareUrl,
    isShareDismissal,
    type ShareSurface,
} from '@/lib/share/appShare';

const log = createLogger('share/app');

type ShareAppResult = {
    /** Opens the native share sheet, or copies the link where there is none. */
    share: () => Promise<void>;
    /** True while the sheet is open, so the button can lock itself. */
    sharing: boolean;
};

/**
 * Hands the game's front door to someone who does not have it.
 *
 * Two paths, and the fallback is not a lesser one: an installed PWA on Android
 * or iOS gets the real share sheet, while a desktop browser without
 * `navigator.share` gets the pitch and the link on the clipboard, which is what
 * a person would have pasted anyway.
 */
export function useShareApp(surface: ShareSurface): ShareAppResult {
    const t = useTranslations('Share');
    const posthog = usePostHog();
    const [sharing, setSharing] = useState(false);

    const share = useCallback(async () => {
        const url = buildAppShareUrl(getURL('/'), surface);
        const message = t('message');
        const title = t('title');

        const copyLink = async () => {
            const { copyToClipboard } = await import('@/lib/utils');
            if (await copyToClipboard(buildAppShareMessage(message, url))) {
                toast.success(t('toasts.copied'));
                posthog.capture('app_shared', { surface, method: 'clipboard' });
                return;
            }
            log.error('share_app', 'Could not copy the app link to the clipboard', { surface, url });
            toast.error(t('toasts.failed'));
        };

        setSharing(true);
        try {
            if (typeof navigator !== 'undefined' && navigator.share) {
                await navigator.share({ title, text: message, url });
                posthog.capture('app_shared', { surface, method: 'native' });
                return;
            }
            await copyLink();
        } catch (error) {
            if (isShareDismissal(error)) {
                log.debug('share_app', 'Player dismissed the share sheet', { surface });
                posthog.capture('app_share_dismissed', { surface });
                return;
            }
            // The sheet itself failed — the intent to share stands, so fall back
            // rather than leaving the player with nothing.
            log.warn('share_app', 'Native share failed, falling back to the clipboard', {
                surface,
                url,
                reason: getErrorMessage(error),
            });
            await copyLink();
        } finally {
            setSharing(false);
        }
    }, [surface, t, posthog]);

    return { share, sharing };
}
