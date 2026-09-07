import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import type { DailyFeedbackPolicy } from '@/lib/daily/feedbackPolicy';

const log = createLogger('admin/feedback-settings');

const ENDPOINT = '/api/admin/game-settings';

/** The settings key this panel writes. Must match `DAILY_FEEDBACK_KEY`. */
const KEY = 'daily_feedback';

/**
 * Editing state for the reward-feedback panel.
 *
 * Same shape as `useGameSettingsForm` and deliberately not merged with it: the
 * two panels write different keys, and a shared draft would make "unsaved
 * changes" ambiguous about which half of the page it meant.
 */
export function useFeedbackSettingsForm(initial: { policy: DailyFeedbackPolicy; revision: number }) {
    const [baseline, setBaseline] = useState<DailyFeedbackPolicy>({ ...initial.policy });
    const [policy, setPolicy] = useState<DailyFeedbackPolicy>({ ...initial.policy });
    const [revision, setRevision] = useState(initial.revision);
    const [saving, setSaving] = useState(false);

    const isDirty = useMemo(
        () => JSON.stringify(policy) !== JSON.stringify(baseline),
        [policy, baseline],
    );

    const setField = useCallback(<K extends keyof DailyFeedbackPolicy>(
        key: K,
        value: DailyFeedbackPolicy[K],
    ) => {
        setPolicy((prev) => ({ ...prev, [key]: value }));
    }, []);

    const discard = useCallback(() => setPolicy({ ...baseline }), [baseline]);

    const replace = useCallback((next: DailyFeedbackPolicy) => setPolicy({ ...next }), []);

    const save = useCallback(async () => {
        setSaving(true);

        try {
            const res = await fetch(ENDPOINT, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: KEY, policy }),
            });

            const body = await res.json();

            if (!res.ok) {
                log.error('save', 'Failed to save the reward-feedback policy', {
                    status: res.status,
                    reason: String(body?.error),
                });
                toast.error(String(body?.error ?? 'Could not save the feedback settings'));
                return;
            }

            // Adopt what the server stored rather than what was sent: the policy
            // is clamped on write, and showing the submitted value would hide
            // any clamping the panel should be honest about.
            setPolicy({ ...body.policy });
            setBaseline({ ...body.policy });
            setRevision(body.revision);

            toast.success(`Saved. Feedback is now on revision ${body.revision}.`);
        } catch (e) {
            log.error('save', 'Network error while saving the reward-feedback policy', undefined, e);
            toast.error('Could not reach the server');
        } finally {
            setSaving(false);
        }
    }, [policy]);

    return { policy, revision, saving, isDirty, setField, discard, replace, save };
}
