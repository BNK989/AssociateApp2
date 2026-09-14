import { motion } from 'framer-motion';
import {
    ArrowRight, AlignHorizontalDistributeCenter, Lightbulb, Signpost, Split, Eye, X, type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { STREAK_MULTIPLIER } from '@/lib/gameConfig';
import type {
    ChoicePrices, StuckAction, StuckOffer as Offer, StuckOfferKind,
} from '@/lib/daily/stuckSignals';

/**
 * The offer at full width: one line of copy, its action, and a way out.
 *
 * Deliberately quiet furniture: muted, one line, dismissible. Anything louder
 * would read as the game pitying the player, which is the failure mode the
 * whole mechanic is built to avoid.
 *
 * It **floats** above the composer rather than sitting in the column with it.
 * In the flow it was a block that appeared from nothing and shoved the whole
 * board upward mid-word — the game lurching while the player was reading it,
 * which reads as a fault rather than as an offer. Anchored to the top edge of
 * the input row it costs no layout height at all, so nothing behind it moves.
 */

/** Only offers with something to do carry a button. */
export const ACTION_ICONS: Partial<Record<StuckOfferKind, LucideIcon>> = {
    other_end: Split,
    letter: Lightbulb,
    // Letters lining up into their slots, which is literally what the offer
    // does. Deliberately not another lightbulb: the drip is a different kind of
    // help from the hint above it, and an icon the player has already learned
    // to read as "hint" would say it is more of the same.
    settle: AlignHorizontalDistributeCenter,
    reveal: Eye,
    // A fork in the road: the one offer with two ways to take it up.
    choice: Signpost,
};

/**
 * How close the bonus has to be before it is worth mentioning.
 *
 * "Three more solves" is not a reason to keep going, it is arithmetic. One or
 * two is a reason.
 */
const BONUS_WORTH_MENTIONING = 2;

type Message = { key: string; values: Record<string, string | number> };

function stakeMessage(offer: Extract<Offer, { kind: 'stake' }>): Message {
    const mentionBonus = offer.solvesToBonus > 0 && offer.solvesToBonus <= BONUS_WORTH_MENTIONING;

    return mentionBonus
        ? { key: 'stake_bonus', values: { solves: offer.solvesToBonus, multiplier: STREAK_MULTIPLIER } }
        : { key: 'stake_words', values: { count: offer.wordsLeft } };
}

export function messageFor(offer: Offer): Message {
    if (offer.kind === 'stake') return stakeMessage(offer);

    // The settle count is here because it used to be a badge on the button,
    // where a bare number read as a clock. The choice does without: its title
    // is three words on purpose, so the two buttons carry the sentence.
    if (offer.kind === 'settle') {
        return { key: 'settle_title', values: { count: offer.lettersLeft } };
    }

    return { key: `${offer.kind}_title`, values: {} };
}

type StuckOfferBarProps = {
    offer: Offer;
    onAct: (action: StuckAction) => void;
    onDismiss: () => void;
    /**
     * What each fork of the choice costs. Absent when the game master has
     * turned the quote off, or for any offer that is not the choice.
     */
    prices?: ChoicePrices;
};

const BUTTON_CLASS = 'flex items-center gap-1 rounded-md bg-background px-2 py-1 text-xs font-medium'
    + ' text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground'
    + ' focus:outline-none focus:ring-2 focus:ring-ring';

/**
 * One way of taking the offer up. A free fork quotes no price: "0 pts" reads
 * as a bug, not as generosity.
 */
function ActionButton({ icon: Icon, label, price, onClick }: {
    icon: LucideIcon;
    label: string;
    price?: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            // Keeps the mobile keyboard open, as the other input-row controls do.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            className={BUTTON_CLASS}
        >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
            {price
                ? <span className="font-normal text-muted-foreground">{price}</span>
                : <ArrowRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />}
        </button>
    );
}

/**
 * The fork at hint level 2: read the clue, or let the loose letters walk in.
 * Both stay available afterwards; this only decides which comes first.
 */
function ChoiceActions({ prices, onAct }: Pick<StuckOfferBarProps, 'prices' | 'onAct'>) {
    const t = useTranslations('GameRoom.Stuck');
    const quote = (key: 'price' | 'price_each', points?: number) =>
        points ? t(key, { points }) : undefined;

    return (
        <>
            <ActionButton
                icon={Lightbulb}
                label={t('choice_clue')}
                price={quote('price', prices?.clue)}
                onClick={() => onAct('clue')}
            />
            <ActionButton
                icon={AlignHorizontalDistributeCenter}
                label={t('choice_place')}
                price={quote('price_each', prices?.place)}
                onClick={() => onAct('place')}
            />
        </>
    );
}

export function StuckOfferBar({ offer, onAct, onDismiss, prices }: StuckOfferBarProps) {
    const t = useTranslations('GameRoom.Stuck');

    const message = messageFor(offer);
    const ActionIcon = offer.kind === 'choice' ? undefined : ACTION_ICONS[offer.kind];

    return (
        <motion.div
            role="status"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            // Anchored to the top edge of the input row, so it costs no layout
            // height and the board behind it never moves.
            // Wraps so the two-button choice can drop its buttons under the
            // copy on a narrow phone instead of squeezing the copy to nothing.
            className="absolute bottom-full inset-x-0 z-20 mx-2 mb-1 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/95 px-3 py-1.5 text-sm shadow-md backdrop-blur-sm"
        >
            <span className="flex-1 text-muted-foreground">{t(message.key, message.values)}</span>
            {offer.kind === 'choice' && <ChoiceActions prices={prices} onAct={onAct} />}
            {ActionIcon && (
                <ActionButton
                    icon={ActionIcon}
                    label={t(`${offer.kind}_action`)}
                    onClick={() => onAct(offer.kind as StuckAction)}
                />
            )}

            <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onDismiss}
                aria-label={t('dismiss')}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
        </motion.div>
    );
}
