import { motion } from 'framer-motion';
import { ArrowRight, Lightbulb, Split, Eye, X, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { STREAK_MULTIPLIER } from '@/lib/gameConfig';
import type { StuckOffer as Offer, StuckOfferKind } from '@/lib/daily/stuckSignals';

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
    reveal: Eye,
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
    return offer.kind === 'stake'
        ? stakeMessage(offer)
        : { key: `${offer.kind}_title`, values: {} };
}

type StuckOfferBarProps = {
    offer: Offer;
    onAct: (kind: StuckOfferKind) => void;
    onDismiss: () => void;
};

export function StuckOfferBar({ offer, onAct, onDismiss }: StuckOfferBarProps) {
    const t = useTranslations('GameRoom.Stuck');

    const message = messageFor(offer);
    const ActionIcon = ACTION_ICONS[offer.kind];

    return (
        <motion.div
            role="status"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            // Anchored to the top edge of the input row, so it costs no layout
            // height and the board behind it never moves.
            className="absolute bottom-full inset-x-0 z-20 mx-2 mb-1 flex items-center gap-2 rounded-lg border border-border bg-background/95 px-3 py-1.5 text-sm shadow-md backdrop-blur-sm"
        >
            <span className="flex-1 text-muted-foreground">
                {t(message.key, message.values)}
            </span>

            {ActionIcon && (
                <button
                    type="button"
                    // Keeps the mobile keyboard open, as the other input-row
                    // controls do — losing it here would read as a punishment
                    // for accepting help.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onAct(offer.kind)}
                    className="flex items-center gap-1 rounded-md bg-background px-2 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <ActionIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {t(`${offer.kind}_action`)}
                    <ArrowRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
                </button>
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
