import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlignHorizontalDistributeCenter, Eye, Settings, Split } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SettleProgressRing } from './SettleProgressRing';
import { SettleBadge } from './SettleBadge';

/** Hold this long to open the menu instead of taking a letter. */
const LONG_PRESS_MS = 500;

type SettleButtonProps = {
    disabled: boolean;
    /** Letters the drip may still place on this word. */
    lettersLeft: number;
    secondsLeft: number;
    /** 0–100 toward the next letter. */
    progress: number;
    /** Whether letters are already arriving on their own. */
    running: boolean;
    /** Take the next letter now rather than waiting the interval out. */
    onSettleNow: () => void;
    onReveal?: () => void;
    canOpenOtherEnd?: boolean;
    onOpenOtherEnd?: () => void;
    onOpenSettings?: () => void;
    /** Tutorial anchor, inherited from whichever control it replaces. */
    id?: string;
};

/**
 * Takes the next letter. Stands where the reveal button used to, once the hint
 * ladder is spent and the drip still has something to give.
 *
 * **This is the change that matters most about the settle drip.** The mechanic
 * already existed, but the composer still replaced the hint button with the eye
 * the moment the ladder ran out — so the one permanent control in front of a
 * stuck player said *give up*, and the drip was only ever offered transiently,
 * after half a minute of silence, in a bar that could be dismissed. A player
 * who waved that away, or never waited long enough to see it, had the old cliff
 * exactly as before.
 *
 * The ladder now runs all the way down in the composer itself:
 *
 * > hint → hint → hint → **letter, letter, letter** → reveal
 *
 * The reveal has not gone anywhere — it is in the long-press menu, where it
 * already was, and it comes back as the button as soon as the letters run out.
 * It is simply no longer the *first* thing offered to someone who is stuck.
 *
 * Tapping takes a letter immediately, which is the same move the hint button
 * makes against its own countdown: a clock the player can always pre-empt.
 */
export function SettleButton({
    disabled,
    lettersLeft,
    secondsLeft,
    progress,
    running,
    onSettleNow,
    onReveal,
    canOpenOtherEnd,
    onOpenOtherEnd,
    onOpenSettings,
    id,
}: SettleButtonProps) {
    const t = useTranslations('GameRoom.Input');
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const wasLongPress = useRef(false);

    const handlePointerDown = (e: React.PointerEvent) => {
        // Keep focus (and the mobile keyboard) unless this is a right-click.
        if (e.button !== 2) e.preventDefault();

        wasLongPress.current = false;
        longPressTimer.current = setTimeout(() => {
            wasLongPress.current = true;
            setIsMenuOpen(true);
        }, LONG_PRESS_MS);
    };

    const cancelLongPress = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    return (
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen} modal={false}>
            <DropdownMenuTrigger asChild>
                <div className="relative">
                    <motion.button
                        type="button"
                        id={id}
                        disabled={disabled}
                        whileTap={{ scale: 0.9 }}
                        onPointerDown={handlePointerDown}
                        onPointerUp={cancelLongPress}
                        onPointerLeave={cancelLongPress}
                        onTap={() => {
                            if (wasLongPress.current) return;
                            onSettleNow();
                        }}
                        onContextMenu={(e: React.MouseEvent) => {
                            e.preventDefault();
                            setIsMenuOpen(true);
                        }}
                        aria-label={t('settle_place_letter')}
                        className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {running && <SettleProgressRing progress={progress} />}

                        <AlignHorizontalDistributeCenter
                            className="z-10 h-4 w-4 text-[var(--tile-present)]"
                            aria-hidden="true"
                        />
                    </motion.button>

                    <SettleBadge
                        lettersLeft={lettersLeft}
                        secondsLeft={secondsLeft}
                        running={running}
                    />
                </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" onCloseAutoFocus={(e: Event) => e.preventDefault()}>
                {canOpenOtherEnd && (
                    <DropdownMenuItem onClick={() => onOpenOtherEnd?.()}>
                        <Split className="me-2 h-4 w-4" />
                        {t('open_other_end')}
                    </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={() => onReveal?.()}>
                    <Eye className="me-2 h-4 w-4" />
                    {t('reveal_word')}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => onOpenSettings?.()}>
                    <Settings className="me-2 h-4 w-4" />
                    {t('settings')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
