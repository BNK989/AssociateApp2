import { motion } from 'framer-motion';
import { Check, Lightbulb, Shuffle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/** Fades a label out after it has been read once, leaving the icon behind. */
const FADE_OUT_LABEL = {
    initial: { width: 'auto', opacity: 1, paddingLeft: 4 },
    animate: { width: 0, opacity: 0, paddingLeft: 0 },
    transition: { delay: 3, duration: 0.8, ease: 'easeInOut' as const },
};

const PANEL_REVEAL = {
    layout: true,
    initial: { opacity: 0, height: 0, scale: 0.95 },
    animate: { opacity: 1, height: 'auto', scale: 1 },
    transition: {
        layout: { duration: 0.3, type: 'spring' as const, bounce: 0 },
        opacity: { duration: 0.2 },
    },
};

/**
 * Strength of the association between this word and the previous one.
 * Currently hidden (see knowledge base/game-instructions.md) but kept wired.
 */
export function ConnectionScoreBadge({ score, compact }: { score: number; compact: boolean }) {
    const t = useTranslations('GameRoom.Chat');

    const [dots, labelKey] = score >= 0.85
        ? ['●●●', 'link_strong'] as const
        : score >= 0.60
            ? ['●●○', 'link_medium'] as const
            : ['●○○', 'link_weak'] as const;

    const tone = score >= 0.85 ? 'text-green-500' : score >= 0.60 ? 'text-yellow-500' : 'text-red-500';

    return (
        <div className="hidden absolute -top-3 start-2 z-10 items-center gap-1.5 px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-bottom-2">
            <span className={`${tone} text-[10px]`} title={t(labelKey)}>{dots}</span>
            {!compact && (
                <span className="text-[10px] uppercase font-bold text-gray-400 select-none">
                    {t(labelKey)}
                </span>
            )}
        </div>
    );
}

/** Re-scrambles a partially revealed word so the letters land somewhere new. */
export function ShuffleHintButton({ compact, onShuffle }: { compact: boolean; onShuffle: () => void }) {
    const t = useTranslations('GameRoom.Chat');

    return (
        <motion.div
            {...PANEL_REVEAL}
            className={`absolute bottom-0.5 start-1 z-10 ${compact ? 'scale-75 origin-bottom-left rtl:origin-bottom-right' : ''}`}
        >
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div
                            onClick={(e) => { e.stopPropagation(); onShuffle(); }}
                            onMouseDown={(e) => e.preventDefault()}
                            className="flex items-center cursor-pointer p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors active:scale-95 group"
                        >
                            <Shuffle className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 group-hover:text-indigo-500 transition-all" />
                            {!compact && (
                                <motion.span
                                    {...FADE_OUT_LABEL}
                                    className="overflow-hidden whitespace-nowrap text-[10px] font-medium text-indigo-500/80 dark:text-indigo-400/80 select-none"
                                >
                                    {t('shuffle')}
                                </motion.span>
                            )}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs px-2 py-1">
                        <p>{t('shuffle')}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </motion.div>
    );
}

type StrikeIndicatorProps = {
    strikes: number;
    isCorrect: boolean;
    isFailed: boolean;
    /** Long enough for the text label to fit alongside the dots. */
    showLabel: boolean;
};

/** Lives remaining, or the final solved / lost state. */
export function StrikeIndicator({ strikes, isCorrect, isFailed, showLabel }: StrikeIndicatorProps) {
    const t = useTranslations('GameRoom.Chat');
    const livesLeft = 3 - strikes;
    const isWarning = livesLeft === 1;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-1 end-1 flex items-center gap-1 z-10"
        >
            {isCorrect ? (
                <div className="flex items-center text-green-500 dark:text-green-400 opacity-90" title={t('solved')}>
                    <Check className="w-4 h-4" />
                </div>
            ) : isFailed ? (
                <div className="flex items-center text-gray-400 dark:text-gray-500 opacity-80" title={t('word_lost')}>
                    <X className="w-4 h-4" />
                </div>
            ) : (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded backdrop-blur-[1px]">
                    <div className="flex gap-0.5">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className={`w-1.5 h-1.5 rounded-full shadow-[0_0_1px_rgba(0,0,0,0.2)] ${i <= livesLeft
                                    ? (isWarning ? 'bg-orange-500 shadow-[0_0_4px_rgba(249,115,22,0.6)]' : 'bg-white dark:bg-gray-200')
                                    : 'bg-black/10 dark:bg-white/10'
                                    }`}
                            />
                        ))}
                    </div>

                    {showLabel && (
                        <motion.span
                            {...FADE_OUT_LABEL}
                            className="overflow-hidden whitespace-nowrap text-[10px] font-medium text-gray-600 dark:text-gray-300 select-none"
                        >
                            {strikes === 1 ? t('counter_remain', { count: 2 }) : t('counter_last')}
                        </motion.span>
                    )}
                </div>
            )}
        </motion.div>
    );
}

/** The level-3 AI hint, or its loading state while Gemini is being consulted. */
export function AiHintPanel({ hint }: { hint?: string }) {
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
