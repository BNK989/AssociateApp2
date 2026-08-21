import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

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
                    exit={{ transition: { duration: 0.8 } }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-6"
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
