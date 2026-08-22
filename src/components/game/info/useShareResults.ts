import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { createLogger, getErrorMessage } from '@/lib/logger';

const log = createLogger('game/info');

type ShareArgs = {
    /**
     * The finished, spoiler-free result, built once by the daily client.
     *
     * This hook used to format its own text and had drifted from the one on the
     * end-of-game summary: it named the day's theme, which hands the recipient
     * the hardest part of the puzzle before they open it. Wording now lives in
     * a single place -- see `useDailyShareText`.
     */
    shareText?: string;
};

/**
 * Shares the player's daily result via the native share sheet, falling back to
 * the clipboard where that is unavailable or dismissed.
 *
 * A rejected share is an ordinary outcome — the player closed the sheet — so it
 * is logged at debug, not as an error.
 */
export function useShareResults({ shareText }: ShareArgs) {
    const t = useTranslations('GameRoom.Info');

    return useCallback(async () => {
        if (!shareText) return;

        const copyFallback = async (failureMessage: string) => {
            const { copyToClipboard } = await import('@/lib/utils');
            if (await copyToClipboard(shareText)) {
                toast.success(t('toast_copied'));
            } else {
                toast.error(failureMessage);
            }
        };

        try {
            if (navigator.share) {
                await navigator.share({ title: 'Daily Chain Results', text: shareText });
                return;
            }
            await copyFallback(t('toast_copy_fail'));
        } catch (error) {
            log.debug('share', 'Native share was dismissed or failed', {
                reason: getErrorMessage(error),
            });
            await copyFallback(t('toast_share_fail'));
        }
    }, [shareText, t]);
}
