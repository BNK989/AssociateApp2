import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';

type SettleBadgeProps = {
    /** Letters the drip may still place on this word. */
    lettersLeft: number;
    /** Seconds until the next one, or 0 when the drip is not running. */
    secondsLeft: number;
    /** Whether letters are currently arriving on their own. */
    running: boolean;
};

/**
 * How many letters are still coming, pinned to the settle button's corner.
 *
 * The count is the part that matters, and it is doing something the ring
 * cannot: it bounds the offer. "Letters will keep arriving" is a promise the
 * game must not make, because the allowance stops well short of the answer —
 * so the player is told up front how many there are, and watches the number
 * come down.
 *
 * That is also what marks the end honestly. When it reaches zero the button
 * gives way to the reveal, and the player has already watched that coming
 * rather than discovering it when the letters silently stopped.
 */
export function SettleBadge({ lettersLeft, secondsLeft, running }: SettleBadgeProps) {
    const t = useTranslations('GameRoom.Input');

    const label = running
        ? t('settle_next_in', { seconds: secondsLeft, count: lettersLeft })
        : t('settle_available', { count: lettersLeft });

    return (
        <span
            aria-label={label}
            title={label}
            className="pointer-events-none absolute -top-3 -end-3 z-20"
        >
            <Badge
                variant="secondary"
                className="flex h-4 min-w-[22px] items-center justify-center gap-0.5 border border-[var(--tile-present)]/50 bg-background px-1 py-0 text-[9px] text-foreground shadow-sm"
            >
                <span className="font-mono font-bold leading-none">{lettersLeft}</span>
            </Badge>
        </span>
    );
}
