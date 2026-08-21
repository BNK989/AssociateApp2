import { useCallback, useEffect, useState } from 'react';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';

/**
 * First-run tutorial, shown once per account.
 *
 * `has_seen_onboarding` is checked against `false` explicitly rather than for
 * falsiness, so the tutorial does not flash while the profile is still loading
 * and the field is undefined.
 */
export function useOnboarding() {
    const { user, profile, refreshProfile } = useAuth();
    const posthog = usePostHog();
    const [showTutorial, setShowTutorial] = useState(false);

    useEffect(() => {
        if (profile && profile.has_seen_onboarding === false) {
            setShowTutorial(true);
            posthog.capture('onboarding_started');
        }
    }, [profile, posthog]);

    const completeTutorial = useCallback(async () => {
        setShowTutorial(false);
        if (!user) return;

        posthog.capture('onboarding_completed');
        await supabase
            .from('profiles')
            .update({ has_seen_onboarding: true })
            .eq('id', user.id);
        await refreshProfile();
    }, [user, posthog, refreshProfile]);

    return { showTutorial, completeTutorial };
}
