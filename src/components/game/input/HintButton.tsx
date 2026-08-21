import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Flag, Lightbulb, Loader2, Pause, Play, Settings, Shuffle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AutoHintBadge } from './AutoHintBadge';
import { HintProgressRing } from './HintProgressRing';
import { nudgeVariants, type NudgeStage } from './useHintNudge';
import type { HintTier } from './inputRules';

/** Hold this long to open the menu instead of buying a hint. */
const LONG_PRESS_MS = 500;

type HintButtonProps = {
    tier: HintTier | null;
    disabled: boolean;
    sending: boolean;
    nudgeStage: NudgeStage;
    isAutoHintActive: boolean;
    autoHintProgress: number;
    autoHintSecondsLeft: number;
    isHintPaused: boolean;
    onGetHint: () => void;
    onToggleHintPause?: () => void;
    onGiveUp?: () => void;
    onOpenSettings?: () => void;
    onInteract: () => void;
};

/** Glyph under the bulb showing which hint comes next. */
function TierBadge({ badge }: { badge: HintTier['badge'] }) {
    const t = useTranslations('GameRoom.Input');

    if (badge === null) return null;
    if (badge === 'shuffle') return <Shuffle className="h-3 w-3" />;
    if (badge === 'ai') return <span>AI</span>;
    return <span>{t('hint_1')}</span>;
}

/**
 * Buys the next hint on tap; opens a menu on long-press or right-click.
 *
 * The menu exists because the button is the only control in reach on mobile —
 * pausing auto-hint, giving up and settings all hang off it.
 */
export function HintButton({
    tier,
    disabled,
    sending,
    nudgeStage,
    isAutoHintActive,
    autoHintProgress,
    autoHintSecondsLeft,
    isHintPaused,
    onGetHint,
    onToggleHintPause,
    onGiveUp,
    onOpenSettings,
    onInteract,
}: HintButtonProps) {
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
            onInteract();
            setIsMenuOpen(true);
        }, LONG_PRESS_MS);
    };

    const cancelLongPress = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const openMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        onInteract();
        setIsMenuOpen(true);
    };

    return (
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen} modal={false}>
            <DropdownMenuTrigger asChild>
                <div className="relative">
                    <motion.button
                        type="button"
                        id="hint-button-trigger"
                        disabled={disabled}
                        variants={nudgeVariants}
                        animate={nudgeStage}
                        whileTap={{ scale: 0.9 }}
                        onPointerDown={handlePointerDown}
                        onPointerUp={cancelLongPress}
                        onPointerLeave={cancelLongPress}
                        onTap={() => {
                            if (wasLongPress.current) return;
                            onInteract();
                            onGetHint();
                        }}
                        onContextMenu={openMenu}
                        className="h-10 w-10 relative flex flex-col items-center justify-center rounded-lg transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isAutoHintActive && !sending && (
                            <HintProgressRing progress={autoHintProgress} />
                        )}

                        <span className="text-sm leading-none mb-0.5 z-10">
                            {sending
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Lightbulb className="h-4 w-4" aria-hidden="true" />}
                        </span>
                        <span className="text-[10px] font-bold leading-none z-10">
                            <TierBadge badge={tier?.badge ?? null} />
                        </span>
                    </motion.button>

                    {isAutoHintActive && (
                        <AutoHintBadge
                            secondsLeft={autoHintSecondsLeft}
                            isPaused={isHintPaused}
                            onToggle={onToggleHintPause}
                        />
                    )}
                </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" onCloseAutoFocus={(e: Event) => e.preventDefault()}>
                {isAutoHintActive && (
                    <DropdownMenuItem onClick={() => onToggleHintPause?.()}>
                        {isHintPaused
                            ? <Play className="w-4 h-4 me-2" />
                            : <Pause className="w-4 h-4 me-2" />}
                        {isHintPaused ? t('resume_auto_hint') : t('pause_auto_hint')}
                    </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={() => onGiveUp?.()} className="text-red-600 focus:text-red-600">
                    <Flag className="w-4 h-4 me-2" />
                    {t('give_up')}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => onOpenSettings?.()}>
                    <Settings className="w-4 h-4 me-2" />
                    {t('settings')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
