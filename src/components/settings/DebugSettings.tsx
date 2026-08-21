'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bug } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/context/AuthProvider';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/lib/supabase';
import { createLogger, isDebugEnabled, setDebugMode } from '@/lib/logger';

const log = createLogger('settings/debug');

/**
 * Admin-only debug toggle.
 *
 * Players never see this control and never see logger output — the logger
 * writes to the console only (CLAUDE.md §8). Non-admins can still enable debug
 * mode for a QA session by loading any page with `?debug=1`, which persists to
 * localStorage without touching their profile.
 */
export default function DebugSettings() {
    const t = useTranslations('Settings');
    const { user, profile, refreshProfile } = useAuth();
    const { isAdmin, loading } = useAdmin();
    const [enabled, setEnabled] = useState(false);
    const [saving, setSaving] = useState(false);

    // Reflect whatever the logger resolved (URL flag, localStorage, or profile).
    useEffect(() => {
        setEnabled(isDebugEnabled());
    }, [profile]);

    if (loading || !isAdmin) return null;

    const handleChange = async (next: boolean) => {
        setEnabled(next);
        setDebugMode(next);

        if (!user) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ settings: { ...profile?.settings, enable_debug_mode: next } })
                .eq('id', user.id);

            if (error) {
                log.error('persist_toggle', 'Failed to save debug preference to profile', {
                    user_id: user.id,
                    enabled: next,
                }, error);
                return;
            }

            log.info('persist_toggle', 'Debug preference saved', { user_id: user.id, enabled: next });
            await refreshProfile();
        } catch (error) {
            log.error('persist_toggle', 'Unexpected failure saving debug preference', {
                user_id: user.id,
                enabled: next,
            }, error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4 pt-4 border-t border-border">
            <h2 className="text-lg font-semibold">{t('debug_section')}</h2>

            <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-2">
                    <Bug className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden="true" />
                    <div className="space-y-1">
                        <Label htmlFor="debug-mode" className="text-sm font-medium">
                            {t('debug_mode')}
                        </Label>
                        <p className="text-xs text-muted-foreground">{t('debug_mode_hint')}</p>
                    </div>
                </div>

                <Switch
                    id="debug-mode"
                    checked={enabled}
                    disabled={saving}
                    onCheckedChange={handleChange}
                />
            </div>
        </div>
    );
}
