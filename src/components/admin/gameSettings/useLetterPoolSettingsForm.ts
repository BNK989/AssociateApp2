import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import type { LetterPoolPolicy } from '@/lib/daily/letterPoolPolicy';

const log = createLogger('admin/letter-pool-settings');

const ENDPOINT = '/api/admin/game-settings';

/** The settings key this panel writes. Must match `LETTER_POOL_KEY`. */
const KEY = 'letter_pool';

/**
 * Editing state for the composer panel.
 *
 * A third sibling of `useGameSettingsForm` and `useFeedbackSettingsForm`,
 * following their shape on purpose: each panel writes its own key, and a shared
 * draft would make "unsaved changes" ambiguous about which part of the page it
 * meant. The three are now close enough to be worth extracting into one generic
 * panel hook, but that is a refactor of working code and belongs in its own
 * change rather than riding along with a new setting.
 */
export function useLetterPoolSettingsForm(initial: { policy: LetterPoolPolicy; revision: number }) {
    const [baseline, setBaseline] = useState<LetterPoolPolicy>({ ...initial.policy });
    const [policy, setPolicy] = useState<LetterPoolPolicy>({ ...initial.policy });
    const [revision, setRevision] = useState(initial.revision);
    const [saving, setSaving] = useState(false);

    const isDirty = useMemo(
        () => JSON.stringify(policy) !== JSON.stringify(baseline),
        [policy, baseline],
    );

    const setField = useCallback(<K extends keyof LetterPoolPolicy>(
        key: K,
        value: LetterPoolPolicy[K],
    ) => {
        setPolicy((prev) => ({ ...prev, [key]: value }));
    }, []);

    const discard = useCallback(() => setPolicy({ ...baseline }), [baseline]);

    const replace = useCallback((next: LetterPoolPolicy) => setPolicy({ ...next }), []);

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
                log.error('save', 'Failed to save the letter pool policy', {
                    status: res.status,
                    reason: String(body?.error),
                });
                toast.error(String(body?.error ?? 'Could not save the composer settings'));
                return;
            }

            // Adopt what the server stored rather than what was sent, so the
            // panel is honest about any normalising the parser did on the way in.
            setPolicy({ ...body.policy });
            setBaseline({ ...body.policy });
            setRevision(body.revision);

            toast.success(`Saved. The composer is now on revision ${body.revision}.`);
        } catch (e) {
            log.error('save', 'Network error while saving the letter pool policy', undefined, e);
            toast.error('Could not reach the server');
        } finally {
            setSaving(false);
        }
    }, [policy]);

    return { policy, revision, saving, isDirty, setField, discard, replace, save };
}
