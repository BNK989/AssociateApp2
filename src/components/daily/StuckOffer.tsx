import { AnimatePresence } from 'framer-motion';
import type { ChoicePrices, StuckAction, StuckOffer as Offer } from '@/lib/daily/stuckSignals';
import { StuckOfferBar } from './StuckOfferBar';
import { StuckOfferPill } from './StuckOfferPill';
import { useOfferPhase } from './useOfferPhase';

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
 * How long it stays is `useOfferPhase`'s call, and the two answers live in
 * different components because they are different objects: a remark that has
 * been read is over, while a route out that has been ignored for a few seconds
 * has only stepped aside. Both are anchored to the same strip above the
 * composer, so one replacing the other moves nothing on the board.
 */

type StuckOfferProps = {
    offer: Offer | null;
    onAct: (action: StuckAction) => void;
    onDismiss: () => void;
    /** Reports a chip the player opened back up. Optional: nothing breaks without it. */
    onReopen?: () => void;
    /** What the level-2 choice's forks cost; absent hides the quote. */
    prices?: ChoicePrices;
};

export function StuckOffer({ offer, onAct, onDismiss, onReopen, prices }: StuckOfferProps) {
    const { phase, expand } = useOfferPhase(offer?.kind ?? null);

    const reopen = () => {
        onReopen?.();
        expand();
    };

    return (
        <AnimatePresence mode="wait">
            {offer && phase === 'expanded' && (
                <StuckOfferBar
                    key={`bar-${offer.kind}`}
                    offer={offer}
                    onAct={onAct}
                    onDismiss={onDismiss}
                    prices={prices}
                />
            )}

            {offer && phase === 'collapsed' && (
                <StuckOfferPill key={`pill-${offer.kind}`} offer={offer} onExpand={reopen} />
            )}
        </AnimatePresence>
    );
}
