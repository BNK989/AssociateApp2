import { useCallback } from 'react';
import { Flag, Flame, HeartPulse, TrendingUp, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { STREAK_MULTIPLIER } from '@/lib/gameConfig';
import { nextProgressCue, type CueArgs, type ProgressCue } from '@/lib/daily/progressCues';

const CUE_ICONS: Record<ProgressCue, LucideIcon> = {
    final_word: Flag,
    recover: HeartPulse,
    streak: Flame,
    halfway: TrendingUp,
};

/** Long enough to read mid-game, short enough not to sit over the next word. */
const CUE_DURATION_MS = 3500;

/**
 * Turns a finished word into at most one encouraging nudge.
 *
 * Deliberately a toast rather than board furniture: it appears on the move that
 * earns it and then gets out of the way, so the chain itself stays the thing
 * being read. Which cue -- if any -- is `nextProgressCue`'s call.
 */
export function useProgressCue() {
    const t = useTranslations('GameRoom.Progress');

    return useCallback((args: CueArgs) => {
        const cue = nextProgressCue(args);
        if (!cue) return;

        const Icon = CUE_ICONS[cue];

        toast(t(`cue_${cue}`, {
            remaining: args.remaining,
            consecutive: args.consecutive,
            multiplier: STREAK_MULTIPLIER,
        }), {
            icon: <Icon className="h-4 w-4" />,
            duration: CUE_DURATION_MS,
        });
    }, [t]);
}
