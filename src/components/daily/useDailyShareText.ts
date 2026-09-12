import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { Message } from '@/hooks/useGameLogic';
import { getURL } from '@/lib/utils';
import {
    MIN_SHAREABLE_STREAK,
    buildShareText,
    dailyPuzzleNumber,
    joinSegments,
    summarizeChain,
} from '@/lib/daily/dailyShare';
import { resolveChainOutcome } from '@/lib/daily/endOutcome';

type UseDailyShareTextArgs = {
    date: string;
    score: number;
    messages: Message[];
    /** Consecutive days finished, once the server has counted them. */
    streak: number | null;
    /** The day's theme, already translated into the player's locale. */
    theme?: string;
};

/**
 * The one place a shareable result is worded.
 *
 * Both share buttons -- the end-of-game summary and the one on the info screen
 * -- take the finished string from here rather than each assembling their own.
 * They previously formatted separately and had already drifted.
 *
 * The closing line is keyed on the outcome tier, read off the same squares the
 * grid is drawn from, so the message can never brag over a board that says
 * otherwise. A cleared chain challenges; a blank one admits it lost, which is
 * the better invitation of the two -- nobody opens a puzzle to watch someone
 * else be good at it.
 */
export function useDailyShareText({ date, score, messages, streak, theme }: UseDailyShareTextArgs): string {
    const t = useTranslations('DailyShare');

    return useMemo(() => {
        const squares = summarizeChain(messages);
        const outcome = resolveChainOutcome(squares);
        const number = dailyPuzzleNumber(date);
        const title = theme?.trim();

        const headline = title
            ? t('headline', { number, theme: title })
            : t('headline_untitled', { number });

        const statsLine = joinSegments([
            t('stats', { solved: outcome.solved, total: outcome.total, score }),
            streak !== null && streak >= MIN_SHAREABLE_STREAK ? t('streak', { streak }) : null,
        ]);

        return buildShareText({
            headline,
            squares,
            statsLine,
            ctaLine: t(`cta_${outcome.tier}`, { score }),
            url: getURL('/daily'),
        });
    }, [date, score, messages, streak, theme, t]);
}
