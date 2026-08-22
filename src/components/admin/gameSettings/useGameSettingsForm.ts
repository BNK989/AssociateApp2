import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import {
    MAX_RUNG_DELAY_SECONDS,
    type DailyHintPolicy,
    type HintRung,
} from '@/lib/daily/hintPolicy';

const log = createLogger('admin/game-settings');

const ENDPOINT = '/api/admin/game-settings';

export type GameSettingsScope = 'default' | 'force';

type Baseline = {
    policy: DailyHintPolicy;
    scope: GameSettingsScope;
};

function clonePolicy(policy: DailyHintPolicy): DailyHintPolicy {
    return { ...policy, rungs: policy.rungs.map((r) => ({ ...r })) as DailyHintPolicy['rungs'] };
}

/**
 * Editing state for the game-settings panel.
 *
 * Changes are held locally until saved, so a half-typed delay never reaches
 * live players. The baseline is what was last successfully written, which is
 * what "unsaved changes" and "discard" are measured against — after a save it
 * becomes the new value rather than the value the page was first loaded with.
 */
export function useGameSettingsForm(initial: Baseline & { revision: number }) {
    const [baseline, setBaseline] = useState<Baseline>({
        policy: clonePolicy(initial.policy),
        scope: initial.scope,
    });

    const [policy, setPolicy] = useState<DailyHintPolicy>(() => clonePolicy(initial.policy));
    const [scope, setScope] = useState<GameSettingsScope>(initial.scope);
    const [revision, setRevision] = useState(initial.revision);
    const [saving, setSaving] = useState(false);

    const isDirty = useMemo(
        () => JSON.stringify({ policy, scope }) !== JSON.stringify(baseline),
        [policy, scope, baseline],
    );

    const setField = useCallback(<K extends keyof DailyHintPolicy>(
        key: K,
        value: DailyHintPolicy[K],
    ) => {
        setPolicy((prev) => ({ ...prev, [key]: value }));
    }, []);

    const setRung = useCallback((index: number, patch: Partial<HintRung>) => {
        setPolicy((prev) => ({
            ...prev,
            rungs: prev.rungs.map((rung, i) => (
                i === index
                    ? {
                        ...rung,
                        ...patch,
                        ...(patch.delaySeconds === undefined ? {} : {
                            delaySeconds: clampDelay(patch.delaySeconds),
                        }),
                    }
                    : rung
            )) as DailyHintPolicy['rungs'],
        }));
    }, []);

    const discard = useCallback(() => {
        setPolicy(clonePolicy(baseline.policy));
        setScope(baseline.scope);
    }, [baseline]);

    /** Replaces the whole draft, for "reset to the compiled defaults". */
    const replace = useCallback((next: DailyHintPolicy) => {
        setPolicy(clonePolicy(next));
    }, []);

    const save = useCallback(async () => {
        setSaving(true);

        try {
            const res = await fetch(ENDPOINT, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ policy, scope }),
            });

            const body = await res.json();

            if (!res.ok) {
                log.error('save', 'Failed to save the daily hint policy', {
                    status: res.status,
                    reason: String(body?.error),
                });
                toast.error(String(body?.error ?? 'Could not save the settings'));
                return;
            }

            // Adopt what the server stored rather than what was sent: the policy
            // is normalised on write, and showing the submitted value would hide
            // any clamping the panel should be honest about.
            setPolicy(clonePolicy(body.policy));
            setScope(body.scope);
            setRevision(body.revision);
            setBaseline({ policy: clonePolicy(body.policy), scope: body.scope });

            toast.success(`Saved. Now on revision ${body.revision}.`);
        } catch (e) {
            log.error('save', 'Network error while saving the daily hint policy', undefined, e);
            toast.error('Could not reach the server');
        } finally {
            setSaving(false);
        }
    }, [policy, scope]);

    return {
        policy,
        scope,
        revision,
        saving,
        isDirty,
        setField,
        setRung,
        setScope,
        replace,
        discard,
        save,
    };
}

function clampDelay(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(MAX_RUNG_DELAY_SECONDS, Math.round(value)));
}
