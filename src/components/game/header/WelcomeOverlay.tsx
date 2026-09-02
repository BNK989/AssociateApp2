import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { CARD_BOX } from '@/components/game/cardBox';

type WelcomeOverlayProps = {
    show: boolean;
    theme?: string;
};

/**
 * Full-screen reveal of the daily theme on entry.
 *
 * The theme text carries `layoutId="theme-text"`, shared with the header's
 * copy, so framer-motion animates it into place rather than cross-fading. The
 * root deliberately does not fade on exit — only the backdrop does — otherwise
 * the shared element would fade out mid-flight.
 *
 * **This overlay never unmounts, by design of a framer quirk we have not
 * cracked.** After the 2.5s timer the backdrop fades to `opacity: 0` but
 * `AnimatePresence` never removes the tree. Removing the root's no-op `exit`
 * did not fix it, and neither did mounting the header's shared-`layoutId` copy
 * only after the handoff — the two copies still coexist for the exit window,
 * and framer appears to hold the exiting one because of that.
 *
 * What that used to cost: `opacity: 0` still receives pointer events, so an
 * invisible full-screen sheet sat at `z-50` over the header and the whole
 * board. Back and Settings could not be tapped and the chain could not be
 * dragged; only the input row, which paints in a later sibling, stayed usable.
 *
 * So the root is `pointer-events-none` and `aria-hidden`: nothing inside it is
 * interactive or worth announcing twice, which makes a lingering mount inert
 * rather than harmful. The residual cost is one dead node in the DOM.
 */
export function WelcomeOverlay({ show, theme }: WelcomeOverlayProps) {
    const t = useTranslations('GameRoom.Header');

    return (
        <AnimatePresence>
            {show && theme && (
                <motion.div
                    key="welcome-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    aria-hidden="true"
                    className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6 ${CARD_BOX}`}
                >
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    />

                    <div className="relative z-10 flex flex-col items-center text-center">
                        <motion.span
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="text-xl md:text-2xl text-gray-200 font-medium mb-3 tracking-wide"
                        >
                            {t('today_theme')}
                        </motion.span>

                        <motion.span
                            layoutId="theme-text"
                            className="text-4xl md:text-5xl font-bold text-white drop-shadow-2xl"
                        >
                            {theme}
                        </motion.span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
