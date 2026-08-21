import { useCallback, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { usePostHog } from 'posthog-js/react';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import { useWalkthrough, type WalkthroughStep } from '@/components/ui/walkthrough';

const log = createLogger('daily/tutorial');

const SEEN_KEY = 'daily_tutorial_seen';

/** Let the board finish laying out before anchoring the first step to it. */
const START_DELAY_MS = 1000;

type UseDailyTutorialArgs = {
    authUser: User | null;
    authLoading: boolean;
    words: string[];
    date: string;
};

/**
 * The first-run walkthrough of the daily board.
 *
 * "Seen" is tracked in localStorage for immediacy and mirrored onto the profile
 * for signed-in players, so it does not reappear on their other devices.
 */
export function useDailyTutorial({ authUser, authLoading, words, date }: UseDailyTutorialArgs) {
    const t = useTranslations('GameRoom.Info.Daily.tutorial');
    const { startTour } = useWalkthrough();
    const posthog = usePostHog();

    const markSeen = useCallback(async () => {
        localStorage.setItem(SEEN_KEY, 'true');
        if (!authUser) return;

        try {
            const { data } = await supabase
                .from('profiles')
                .select('settings')
                .eq('id', authUser.id)
                .single();

            await supabase
                .from('profiles')
                .update({ settings: { ...(data?.settings ?? {}), daily_tutorial_seen: true } })
                .eq('id', authUser.id);
        } catch (e) {
            log.warn('mark_seen', 'Failed to persist tutorial completion to profile', { user_id: authUser.id }, e);
        }
    }, [authUser]);

    /**
     * Steps are built here rather than inlined at each call site so the first
     * run and a manual restart cannot drift apart.
     *
     * The colours step anchors to the second-to-last message — the first word
     * the player will actually face.
     */
    const buildSteps = useCallback((introPosition: 'center' | 'bottom'): WalkthroughStep[] => [
        {
            id: 'step-intro',
            targetId: '',
            title: t('step1_title'),
            content: t('step1_desc'),
            position: introPosition,
        },
        {
            id: 'step-input',
            targetId: 'game-input-area',
            title: t('step2_title'),
            content: t('step2_desc'),
            position: 'top',
        },
        {
            id: 'step-colors',
            targetId: `msg-msg-${words.length - 2}`,
            title: t('step3_title'),
            content: t('step3_desc'),
            position: 'top',
        },
        {
            id: 'step-hint',
            targetId: 'hint-button-trigger',
            title: t('step4_title'),
            content: t('step4_desc'),
            position: 'top',
        },
    ], [t, words.length]);

    /** Replays the walkthrough on demand, from the info screen. */
    const restart = useCallback(() => {
        localStorage.removeItem(SEEN_KEY);

        startTour(buildSteps('center'), {
            onComplete: () => {
                markSeen();
                posthog.capture('daily_tutorial_restarted_completed', { date });
            },
            onSkip: () => {
                markSeen();
                posthog.capture('daily_tutorial_restarted_skipped', { date });
            },
        });
    }, [buildSteps, startTour, markSeen, posthog, date]);

    // First run: start the tour unless this player has already seen it.
    useEffect(() => {
        if (authLoading || words.length === 0) return;

        let cancelled = false;

        const maybeStart = async () => {
            if (localStorage.getItem(SEEN_KEY) === 'true') return;

            if (authUser) {
                const { data } = await supabase
                    .from('profiles')
                    .select('settings')
                    .eq('id', authUser.id)
                    .single();

                if (data?.settings?.daily_tutorial_seen) {
                    localStorage.setItem(SEEN_KEY, 'true');
                    return;
                }
            }

            if (cancelled) return;

            setTimeout(() => {
                if (cancelled) return;
                startTour(buildSteps('bottom'), { onComplete: markSeen, onSkip: markSeen });
            }, START_DELAY_MS);
        };

        maybeStart();
        return () => { cancelled = true; };
    }, [authLoading, authUser, words.length, startTour, buildSteps, markSeen]);

    return { restart };
}
