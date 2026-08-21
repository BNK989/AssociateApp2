import { Pause, Play } from 'lucide-react';
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
 */
export function AutoHintBadge({ secondsLeft, isPaused, onToggle }: AutoHintBadgeProps) {
    return (
        <div
            className="absolute -top-3 -end-3 z-20 cursor-pointer"
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
                    <Play className="w-2.5 h-2.5 text-green-600 animate-pulse" />
                ) : (
                    <>
                        <span className="font-mono font-bold leading-none">{secondsLeft}</span>
                        <div className="h-2 w-[1px] bg-border mx-0.5" />
                        <Pause className="w-2.5 h-2.5 text-muted-foreground" />
                    </>
                )}
            </Badge>
        </div>
    );
}
