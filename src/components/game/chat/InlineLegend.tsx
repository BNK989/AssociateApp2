import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LetterLegend } from '@/components/game/LetterLegend';
import type { LegendSamples } from './legendRules';

type InlineLegendProps = {
    open: boolean;
    /** Which half of the position rule currently applies to this word. */
    positionNote: 'ordered' | 'shuffled';
    /** The word's own tiles, so the samples are the ones just above them. */
    samples: LegendSamples;
    onDismiss: () => void;
};

/**
 * The colour key, opened inside the bubble whose tiles it explains.
 *
 * It borrows the bubble's own surface rather than painting a card of its own,
 * so the sample tiles resolve the same `--tile-*` variables as the word above
 * them — the key and the thing it describes cannot drift apart.
 */
export function InlineLegend({ open, positionNote, samples, onDismiss }: InlineLegendProps) {
    const t = useTranslations('GameRoom.Legend');

    return (
        <AnimatePresence initial={false}>
            {open && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                    // A partially revealed bubble re-scrambles on tap. Reading the
                    // key must not cost the player their letters.
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* The heading is carried by the label rather than a line of
                        chrome: the samples sit directly under the word they
                        explain, and a bubble cannot spare 22px to restate it. */}
                    <div
                        role="note"
                        aria-label={t('title')}
                        className="relative mt-1.5 pt-1.5 pe-6 border-t border-black/10 dark:border-white/15"
                    >
                        <button
                            type="button"
                            onClick={onDismiss}
                            aria-label={t('dismiss')}
                            className="absolute end-0 top-1 rounded-full p-1 opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <X className="h-3 w-3" aria-hidden="true" />
                        </button>

                        <LetterLegend variant="inline" positionNote={positionNote} samples={samples} />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
