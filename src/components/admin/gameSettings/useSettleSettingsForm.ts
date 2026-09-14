import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import type { SettlePolicy } from '@/lib/daily/settlePolicy';

const log = createLogger('admin/settle-settings');

const ENDPOINT = '/api/admin/game-settings';

/** The settings key this panel writes. Must match `SETTLE_KEY`. */
const KEY = 'settle';

/**
 * Editing state for the settle panel.
 *
 * A fourth sibling of `useGameSettingsForm`, `useFeedbackSettingsForm` and
 * `useLetterPoolSettingsForm`, following their shape on purpose: each panel
 * writes its own key, and a shared draft would make "unsaved changes"
 * ambiguous about which part of the page it meant.
 *
 * Four near-identical copies is now past the point where the duplication is
 * cheaper than the abstraction, and the three that came before already said so.
 * Extracting one generic panel hook is a refactor of working code and belongs
 * in its own change rather than riding along with a new setting — but it should
 * be the next thing done here, not the fifth copy.
 */
export function useSettleSettingsForm(initial: { policy: SettlePolicy; revision: number }) {
    const [baseline, setBaseline] = useState<SettlePolicy>({ ...initial.policy });
    const [policy, setPolicy] = useState<SettlePolicy>({ ...initial.policy });
    const [revision, setRevision] = useState(initial.revision);
    const [saving, setSaving] = useState(false);

    const isDirty = useMemo(
        () => JSON.stringify(policy) !== JSON.stringify(baseline),
        [policy, baseline],
    );

    const setField = useCallback(<K extends keyof SettlePolicy>(
        key: K,
        value: SettlePolicy[K],
    ) => {
        setPolicy((prev) => ({ ...prev, [key]: value }));
    }, []);

    const discard = useCallback(() => setPolicy({ ...baseline }), [baseline]);

    const replace = useCallback((next: SettlePolicy) => setPolicy({ ...next }), []);

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
                log.error('save', 'Failed to save the settle policy', {
                    status: res.status,
                    reason: String(body?.error),
                });
                toast.error(String(body?.error ?? 'Could not save the settle settings'));
                return;
            }

            // Adopt what the server stored rather than what was sent, so the
            // panel is honest about any clamping the parser did on the way in.
            setPolicy({ ...body.policy });
            setBaseline({ ...body.policy });
            setRevision(body.revision);

            toast.success(`Saved. The settle drip is now on revision ${body.revision}.`);
        } catch (e) {
            log.error('save', 'Network error while saving the settle policy', undefined, e);
            toast.error('Could not reach the server');
        } finally {
            setSaving(false);
        }
    }, [policy]);

    return { policy, revision, saving, isDirty, setField, discard, replace, save };
}

/** The settle panel's editing state, passed in from the shell. */
export type SettleSettingsFormState = ReturnType<typeof useSettleSettingsForm>;
