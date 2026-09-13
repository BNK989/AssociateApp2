import { useTranslations } from 'next-intl';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Message } from '@/hooks/useGameLogic';
import { HintButton } from './HintButton';
import { RevealButton } from './RevealButton';
import { SettleButton } from './SettleButton';
import { hintsAreFree, valueAfterHint, type HintTier } from './inputRules';
import type { NudgeStage } from './useHintNudge';
import type { SettleControls } from './settleControls';

/** Tutorial anchor. Exactly one control in this slot may ever carry it. */
const ANCHOR_ID = 'hint-button-trigger';

type HintControlsProps = {
    tier: HintTier | null;
    targetMessage?: Message;
    effectiveLevel: number;
    /** The ladder is spent; only the drip and the reveal are left. */
    isMaxHints: boolean;
    disabled: boolean;
    sending: boolean;
    nudgeStage: NudgeStage;
    isAutoHintActive: boolean;
    autoHintProgress: number;
    autoHintSecondsLeft: number;
    isHintPaused: boolean;
    settle?: SettleControls;
    tooltip: { isOpen: boolean; setIsOpen: (open: boolean) => void; hasSeen: boolean; markInteracted: () => void };
    onGetHint: () => void;
    onToggleHintPause?: () => void;
    onReveal?: () => void;
    canOpenOtherEnd?: boolean;
    onOpenOtherEnd?: () => void;
    onOpenSettings?: () => void;
};

/**
 * Which control stands in the composer's help slot.
 *
 * One decision, and it is the shape of the whole escalation a stuck player
 * walks down:
 *
 * > hint → hint → hint → **letter, letter, letter** → reveal
 *
 * Before the settle drip the middle of that was missing from the composer
 * entirely: the moment the ladder ran out the hint button was replaced by the
 * eye, so the only permanent control in front of a stuck player said *give up*.
 * The drip was offered, but transiently — a bar after half a minute of silence,
 * which a player could dismiss or never wait long enough to see.
 *
 * Extracted from `GameInput` when that file reached the line cap. The seam is a
 * real one rather than a convenience: everything here answers a single
 * question, and the component around it has no business knowing the answer.
 */
export function HintControls({
    tier,
    targetMessage,
    effectiveLevel,
    isMaxHints,
    disabled,
    sending,
    nudgeStage,
    isAutoHintActive,
    autoHintProgress,
    autoHintSecondsLeft,
    isHintPaused,
    settle,
    tooltip,
    onGetHint,
    onToggleHintPause,
    onReveal,
    canOpenOtherEnd,
    onOpenOtherEnd,
    onOpenSettings,
}: HintControlsProps) {
    const t = useTranslations('GameRoom.Input');

    if (isMaxHints) {
        // Letters first, and only the reveal once there are none left to give.
        return settle?.available ? (
            <SettleButton
                id={ANCHOR_ID}
                disabled={disabled}
                lettersLeft={settle.lettersLeft}
                secondsLeft={settle.secondsLeft}
                progress={settle.progress}
                running={settle.running}
                onSettleNow={settle.onSettleNow}
                onReveal={onReveal}
                canOpenOtherEnd={canOpenOtherEnd}
                onOpenOtherEnd={onOpenOtherEnd}
                onOpenSettings={onOpenSettings}
            />
        ) : (
            <RevealButton id={ANCHOR_ID} disabled={disabled} onReveal={onReveal} />
        );
    }

    const hintButton = (
        <HintButton
            tier={tier}
            disabled={disabled}
            sending={sending}
            nudgeStage={nudgeStage}
            isAutoHintActive={isAutoHintActive}
            autoHintProgress={autoHintProgress}
            autoHintSecondsLeft={autoHintSecondsLeft}
            isHintPaused={isHintPaused}
            onGetHint={onGetHint}
            onToggleHintPause={onToggleHintPause}
            onReveal={onReveal}
            canOpenOtherEnd={canOpenOtherEnd}
            onOpenOtherEnd={onOpenOtherEnd}
            onOpenSettings={onOpenSettings}
            onInteract={tooltip.markInteracted}
        />
    );

    if (tooltip.hasSeen) return hintButton;

    return (
        <Tooltip open={tooltip.isOpen} onOpenChange={tooltip.setIsOpen}>
            <TooltipTrigger asChild>{hintButton}</TooltipTrigger>
            <TooltipContent side="top" align="start">
                {/*
                  * Benefit, price, then what survives — in that order, and
                  * only while there is a price. It used to open with the price
                  * and close with "deducted from word value", so the only two
                  * numbers a hesitating player read were both losses; with a
                  * free ladder both lines would read as a loss of nothing,
                  * which still frames the hint as a transaction. So the tooltip
                  * says what the rung gives and stops.
                  */}
                <div className="text-xs space-y-1">
                    <p className="font-bold">{tier ? t(tier.labelKey) : ''}</p>
                    {!hintsAreFree() && (
                        <>
                            <p className="text-muted-foreground">
                                {t('cost_pts', { cost: -(tier?.cost ?? 0) })}
                            </p>
                            <p className="text-[10px] text-muted-foreground opacity-70">
                                {t('still_worth', {
                                    points: targetMessage
                                        ? valueAfterHint(targetMessage, effectiveLevel)
                                        : 0,
                                })}
                            </p>
                        </>
                    )}
                </div>
            </TooltipContent>
        </Tooltip>
    );
}
