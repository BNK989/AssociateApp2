import { useCallback } from 'react';
import { Target } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { missMessageKey, type MissBand } from '@/lib/daily/guessFeedback';

/** Short: it has to clear before the player's next attempt. */
const CUE_DURATION_MS = 2500;

/**
 * Tells a player their guess was nearly the word.
 *
 * A toast rather than board furniture, for the same reason the progress cues
 * are: it belongs to the move that earned it and should get out of the way.
 * Only a near miss says anything at all — a cue on every wrong guess would stop
 * being read by the third word, which is exactly when it matters most.
 */
export function useMissCue() {
    const t = useTranslations('GameRoom.Progress');

    return useCallback((band: MissBand, forgiven: boolean) => {
        const key = missMessageKey(band, forgiven);
        if (!key) return;

        toast(t(key), {
            icon: <Target className="h-4 w-4" aria-hidden="true" />,
            duration: CUE_DURATION_MS,
        });
    }, [t]);
}
