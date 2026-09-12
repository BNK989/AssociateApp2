import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import type { StuckOffer as Offer } from '@/lib/daily/stuckSignals';
import { ACTION_ICONS } from './StuckOfferBar';

/**
 * The offer after it has stepped aside.
 *
 * An offer that carries a way out must not simply vanish — the player it was
 * written for is the one still thinking about the word, and they get to the end
 * of that thought well after the bar would have timed out. But leaving the bar
 * at full width over the board for the rest of the word is how it became
 * clutter in the first place.
 *
 * So it collapses to a chip on the inline-end edge of the same anchored strip:
 * still visible, still one tap away, and taking a corner instead of a row. The
 * tap reopens the bar rather than firing the action, because one of the actions
 * spends the word — a chip small enough to be brushed by a thumb must not be
 * able to reveal an answer.
 */

type StuckOfferPillProps = {
    offer: Offer;
    onExpand: () => void;
};

export function StuckOfferPill({ offer, onExpand }: StuckOfferPillProps) {
    const t = useTranslations('GameRoom.Stuck');

    const Icon = ACTION_ICONS[offer.kind];
    if (!Icon) return null;

    return (
        <motion.button
            type="button"
            // Keeps the mobile keyboard open, as the other input-row controls do.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onExpand}
            aria-label={t('reopen')}
            title={t(`${offer.kind}_title`)}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            // Same anchored strip as the bar, so nothing in the column moves
            // when one replaces the other; parked at the inline-end corner.
            className="absolute bottom-full end-0 z-20 me-2 mb-1 flex items-center justify-center rounded-full border border-border bg-background/95 p-2 text-muted-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
            <Icon className="h-4 w-4" aria-hidden="true" />
        </motion.button>
    );
}
