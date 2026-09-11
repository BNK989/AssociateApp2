import { Pause, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';

type AutoHintBadgeProps = {
    secondsLeft: number;
    isPaused: boolean;
    onToggle?: () => void;
};

/**
 * Countdown-and-pause control pinned to the hint button's corner.
 *
 * It sits inside the button's dropdown trigger, so pointer events are stopped
 * here — otherwise pausing would also open the menu or fire the hint.
 *
 * It used to be an unlabelled `div` showing a bare number beside a hint button,
 * which reads as a deadline the player is running out of: a clock counting down
 * to the moment they needed help. It is the opposite — the word opening itself
 * up without being asked — and the label now says so, to a screen reader as
 * well as on hover. Same mechanic, and the framing is the only thing the player
 * had to go on.
 */
export function AutoHintBadge({ secondsLeft, isPaused, onToggle }: AutoHintBadgeProps) {
    const t = useTranslations('GameRoom.Input');

    const label = isPaused ? t('auto_hint_paused') : t('auto_hint_opening', { seconds: secondsLeft });

    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            className="absolute -top-3 -end-3 z-20 cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-ring"
            onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggle?.();
            }}
        >
            <Badge
                variant={isPaused ? 'destructive' : 'secondary'}
                className="px-1 py-0 h-4 min-w-[32px] flex items-center justify-center gap-0.5 text-[9px] shadow-sm hover:scale-110 transition-transform bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 text-foreground"
            >
                {isPaused ? (
                    <Play className="w-2.5 h-2.5 text-green-600 animate-pulse" aria-hidden="true" />
                ) : (
                    <>
                        <span className="font-mono font-bold leading-none">{secondsLeft}</span>
                        <div className="h-2 w-[1px] bg-border mx-0.5" />
                        <Pause className="w-2.5 h-2.5 text-muted-foreground" aria-hidden="true" />
                    </>
                )}
            </Badge>
        </button>
    );
}
