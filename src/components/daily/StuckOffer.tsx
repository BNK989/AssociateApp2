import { ArrowRight, Lightbulb, Split, Eye, X, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { STREAK_MULTIPLIER } from '@/lib/gameConfig';
import type { StuckOffer as Offer, StuckOfferKind } from '@/lib/daily/stuckSignals';

/**
 * The one place the game speaks to a player who has gone quiet on a word.
 *
 * The whole point is the direction of the ask. A hint the player requests is an
 * admission that they could not do it; the same hint arriving as an offer they
 * accept is the game being generous. The mechanics are identical and the
 * feeling is opposite, which makes this the cheapest psychological win in the
 * game — and it is why the actions here duplicate ones already reachable from
 * the hint menu rather than replacing them.
 *
 * Deliberately quiet furniture: muted, one line, dismissible, and gone the
 * moment the word changes. Anything louder would read as the game pitying the
 * player, which is the failure mode this is supposed to avoid.
 */

/** Only offers with something to do carry a button. */
const ACTION_ICONS: Partial<Record<StuckOfferKind, LucideIcon>> = {
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

type StuckOfferProps = {
    offer: Offer | null;
    onAct: (kind: StuckOfferKind) => void;
    onDismiss: () => void;
};

type Message = { key: string; values: Record<string, string | number> };

function stakeMessage(offer: Extract<Offer, { kind: 'stake' }>): Message {
    const mentionBonus = offer.solvesToBonus > 0 && offer.solvesToBonus <= BONUS_WORTH_MENTIONING;

    return mentionBonus
        ? { key: 'stake_bonus', values: { solves: offer.solvesToBonus, multiplier: STREAK_MULTIPLIER } }
        : { key: 'stake_words', values: { count: offer.wordsLeft } };
}

export function StuckOffer({ offer, onAct, onDismiss }: StuckOfferProps) {
    const t = useTranslations('GameRoom.Stuck');

    if (!offer) return null;

    const message: Message = offer.kind === 'stake'
        ? stakeMessage(offer)
        : { key: `${offer.kind}_title`, values: {} };

    const ActionIcon = ACTION_ICONS[offer.kind];

    return (
        <div
            role="status"
            className="mx-2 mb-1 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm"
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
        </div>
    );
}
