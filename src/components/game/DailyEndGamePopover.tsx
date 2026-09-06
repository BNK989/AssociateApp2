'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Share2, Users, ArrowRight, Flame, Target } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createLogger, getErrorMessage } from '@/lib/logger';
import { MIN_SHAREABLE_STREAK, type ShareSquare } from '@/lib/daily/dailyShare';
import type { ChainOutcome } from '@/lib/daily/endOutcome';
import { ChainGrid } from './endgame/ChainGrid';
import { useEndGameConfetti } from './endgame/useEndGameConfetti';

const log = createLogger('daily/endgame');

type DailyEndGamePopoverProps = {
    open: boolean;
    score: number;
    /** How the day actually went, so the screen can say so honestly. */
    outcome: ChainOutcome;
    /** The day's grid, previewed before the player shares it. */
    squares: ShareSquare[];
    /**
     * The finished, spoiler-free result. Built by the client so both share
     * buttons say the same thing; see useDailyShareText.
     */
    shareText: string;
    /** Consecutive days finished, or null while that is unknown. */
    streak?: number | null;
    onClose: () => void;
};

/**
 * The end-of-day summary.
 *
 * It opens on *every* finished chain, not only a cleared one -- the share grid
 * is the game's growth engine and a player who struggled is no less likely to
 * post it, so the one thing this screen must never do is fail to appear. What
 * it says is tiered by outcome instead: congratulations are earned, and a thin
 * day gets an honest reading and a reason to come back rather than fireworks
 * over an empty grid.
 */
export function DailyEndGamePopover({
    open,
    score,
    outcome,
    squares,
    shareText,
    streak,
    onClose,
}: DailyEndGamePopoverProps) {
    const router = useRouter();
    const t = useTranslations('GameRoom.DailyEndGame');
    const [internalOpen, setInternalOpen] = useState(open);

    useEffect(() => {
        setInternalOpen(open);
    }, [open]);

    useEndGameConfetti(internalOpen && open && outcome.celebrate);

    const handleShare = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: t('title'),
                    text: shareText,
                });
            } else {
                await navigator.clipboard.writeText(shareText);
                toast.success(t('toast_copied'));
            }
        } catch (error) {
            log.debug('share', 'Native share was dismissed or failed', { reason: getErrorMessage(error) });
            try {
                await navigator.clipboard.writeText(shareText);
                toast.success(t('toast_copied'));
            } catch (clipboardError) {
                log.warn('share', 'Clipboard fallback failed, the result could not be shared', {
                    tier: outcome.tier,
                }, clipboardError);
                toast.error(t('toast_share_fail'));
            }
        }
    };

    const handleSignUp = () => {
        router.push('/');
    };

    const ScoreIcon = outcome.celebrate ? Trophy : Target;

    const scoreCardClass = outcome.celebrate
        ? 'from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 border-yellow-200 dark:border-yellow-800/30'
        : 'from-muted/60 to-muted/30 border-border';

    return (
        <Dialog open={internalOpen} onOpenChange={setInternalOpen}>
            <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                        {t(`title_${outcome.tier}`)}
                    </DialogTitle>
                    <DialogDescription className="text-center text-gray-400 text-lg">
                        {outcome.tier === 'perfect'
                            ? t('subtitle_perfect', { totalWords: outcome.total })
                            : t('subtitle_progress', { solved: outcome.solved, totalWords: outcome.total })}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-5">
                    <div className={`flex flex-col items-center justify-center p-6 bg-gradient-to-br rounded-2xl border shadow-inner ${scoreCardClass}`}>
                        <ScoreIcon
                            className={`w-12 h-12 mb-2 drop-shadow-md ${outcome.celebrate ? 'text-yellow-500' : 'text-muted-foreground'}`}
                        />
                        <span className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-widest">{t('score_label')}</span>
                        <div className="text-5xl font-black text-gray-900 dark:text-white mt-1 tabular-nums tracking-tight">
                            {score}
                        </div>

                        {streak !== null && streak !== undefined && streak >= MIN_SHAREABLE_STREAK && (
                            <div className="mt-3 flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                                <Flame className="h-4 w-4" />
                                {t('streak_badge', { streak })}
                            </div>
                        )}
                    </div>

                    <ChainGrid squares={squares} />

                    {!outcome.celebrate && (
                        <p className="text-center text-sm text-muted-foreground">{t('come_back')}</p>
                    )}

                    {/* Upsell Card */}
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800/30 relative overflow-hidden group">
                        {/* eslint-disable-next-line no-restricted-syntax -- TODO(rtl): decorative watermark icon, offset by a physical translate-x-4. Needs a design call on whether the ornament should mirror. */}
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Users className="w-24 h-24 text-indigo-500 transform rotate-12 translate-x-4 -translate-y-4" />
                        </div>
                        <div className="relative z-10">
                            <h4 className="font-bold text-indigo-900 dark:text-indigo-300 mb-1 flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                {t('upsell_title')}
                            </h4>
                            <p className="text-sm text-indigo-700 dark:text-indigo-400 mb-3 leading-relaxed">
                                {t('upsell_text')}
                            </p>
                            <Button
                                onClick={handleSignUp}
                                size="sm"
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md transition-all active:scale-95"
                            >
                                {t('sign_up_btn')} <ArrowRight className="w-4 h-4 rtl:rotate-180 ms-1" />
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="sm:justify-center flex-col sm:flex-row gap-3">
                    <Button
                        onClick={handleShare}
                        className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-2 px-8 rounded-full shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2"
                    >
                        <Share2 className="w-4 h-4" />
                        {t('share_btn')}
                    </Button>
                    <Button
                        onClick={onClose}
                        variant="ghost"
                        className="w-full sm:w-auto text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        {t('home_btn')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
