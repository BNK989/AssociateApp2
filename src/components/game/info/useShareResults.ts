import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { createLogger, getErrorMessage } from '@/lib/logger';

const log = createLogger('game/info');

type ShareArgs = {
    date?: string;
    theme?: string;
    score: number;
};

/**
 * Shares the player's daily result via the native share sheet, falling back to
 * the clipboard where that is unavailable or dismissed.
 *
 * A rejected share is an ordinary outcome — the player closed the sheet — so it
 * is logged at debug, not as an error.
 */
export function useShareResults({ date, theme, score }: ShareArgs) {
    const t = useTranslations('GameRoom.Info');

    return useCallback(async () => {
        if (!date) return;

        const text = t('daily_share_text', {
            date,
            score,
            theme: theme ?? '',
            url: `${window.location.origin}/daily`,
        });

        const copyFallback = async (failureMessage: string) => {
            const { copyToClipboard } = await import('@/lib/utils');
            if (await copyToClipboard(text)) {
                toast.success(t('toast_copied'));
            } else {
                toast.error(failureMessage);
            }
        };

        try {
            if (navigator.share) {
                await navigator.share({ title: 'Daily Chain Results', text });
                return;
            }
            await copyFallback(t('toast_copy_fail'));
        } catch (error) {
            log.debug('share', 'Native share was dismissed or failed', {
                reason: getErrorMessage(error),
            });
            await copyFallback(t('toast_share_fail'));
        }
    }, [date, theme, score, t]);
}
