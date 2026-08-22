import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { Message } from '@/hooks/useGameLogic';
import { getURL } from '@/lib/utils';
import {
    MIN_SHAREABLE_STREAK,
    buildShareText,
    countSolved,
    dailyPuzzleNumber,
    summarizeChain,
} from '@/lib/daily/dailyShare';

type UseDailyShareTextArgs = {
    date: string;
    score: number;
    messages: Message[];
    /** Consecutive days finished, once the server has counted them. */
    streak: number | null;
};

/**
 * The one place a shareable result is worded.
 *
 * Both share buttons -- the end-of-game summary and the one on the info screen
 * -- take the finished string from here rather than each assembling their own.
 * They previously formatted separately and had already drifted: the info
 * screen's version named the day's theme, which tells the recipient the answer
 * to the hardest part of the puzzle before they have opened it.
 */
export function useDailyShareText({ date, score, messages, streak }: UseDailyShareTextArgs): string {
    const t = useTranslations('DailyShare');

    return useMemo(() => {
        const squares = summarizeChain(messages);

        const headline = t('headline', {
            number: dailyPuzzleNumber(date),
            solved: countSolved(squares),
            total: squares.length,
            score,
        });

        const streakLine = streak !== null && streak >= MIN_SHAREABLE_STREAK
            ? t('streak', { streak })
            : null;

        return buildShareText({
            headline,
            squares,
            streakLine,
            url: getURL('/daily'),
        });
    }, [date, score, messages, streak, t]);
}
