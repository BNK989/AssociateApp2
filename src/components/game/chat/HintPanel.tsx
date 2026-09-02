import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { HintDisplay } from './messageFlags';

const PANEL_REVEAL = {
    layout: true,
    initial: { opacity: 0, height: 0, scale: 0.95 },
    animate: { opacity: 1, height: 'auto', scale: 1 },
    transition: {
        layout: { duration: 0.3, type: 'spring' as const, bounce: 0 },
        opacity: { duration: 0.2 },
    },
};

const DISCLOSURE_REVEAL = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto' },
    exit: { opacity: 0, height: 0 },
    transition: { duration: 0.2, ease: 'easeOut' as const },
};

/**
 * The level-3 AI clue, rendered for the stage the bubble is in.
 *
 * The clue is the loudest thing a bubble can carry, so it is only allowed to
 * stay loud while it is still doing work. Once the word is settled the clue has
 * been spent — the answer is right there above it — and it collapses to a chip
 * the player can reopen if they want to see what they were given. That keeps
 * the scroll readable: a chain of solved words used to cost ninety pixels of
 * amber each, which crowded the one word still being played off the screen.
 */
export function HintPanel({ display, hint }: { display: HintDisplay; hint?: string }) {
    if (display === 'none') return null;
    if (display === 'collapsed') return <SpentHint hint={hint} />;

    return <OpenHint hint={hint} />;
}

/** The clue while it is still the working surface for the active word. */
function OpenHint({ hint }: { hint?: string }) {
    const t = useTranslations('GameRoom.Chat');

    return (
        <motion.div
            {...PANEL_REVEAL}
            className={`mt-2 text-xs font-medium p-2 rounded border overflow-hidden ${hint
                ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800'
                : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
                }`}
        >
            {hint ? (
                <div className="flex items-start gap-1.5 animate-in fade-in duration-300">
                    <Lightbulb className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
                    <span className="leading-snug">{hint}</span>
                </div>
            ) : (
                <div className="flex items-center gap-2 h-5">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="ms-1">{t('consulting_ai')}</span>
                </div>
            )}
        </motion.div>
    );
}

/**
 * The clue on a settled word: a one-line record that it was used, opening on
 * demand. Doubles as the only place the player can see, mid-game, which words
 * cost them a hint.
 */
function SpentHint({ hint }: { hint?: string }) {
    const t = useTranslations('GameRoom.Chat');
    const [open, setOpen] = useState(false);

    if (!hint) return null;

    return (
        <div className="mt-1.5">
            <button
                type="button"
                aria-expanded={open}
                onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
                onMouseDown={(e) => e.preventDefault()}
                className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors"
            >
                <Lightbulb className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>{t('hint_used')}</span>
                <ChevronDown
                    className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.p
                        {...DISCLOSURE_REVEAL}
                        className="overflow-hidden text-xs leading-snug text-gray-600 dark:text-gray-300 ps-4 pt-1"
                    >
                        {hint}
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
}
