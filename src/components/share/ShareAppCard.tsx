'use client';

import { Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ShareAppButton } from './ShareAppButton';

/**
 * The standing nudge to spread the game.
 *
 * A header button is only found by someone already looking for it; growth is a
 * product goal, so the lobby asks outright — once, in its own card, below the
 * games rather than in front of them.
 */
export function ShareAppCard() {
    const t = useTranslations('Share.card');

    return (
        <section className="relative overflow-hidden rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-100 to-blue-100 p-6 dark:border-purple-500/20 dark:from-purple-950/40 dark:to-blue-950/40">
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <div className="rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 p-3 text-white shadow-lg shadow-purple-500/20">
                        <Share2 className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100">
                            {t('title')}
                        </h3>
                        <p className="text-sm text-purple-700 dark:text-muted-foreground">
                            {t('description')}
                        </p>
                    </div>
                </div>

                <ShareAppButton
                    surface="lobby_card"
                    variant="default"
                    className="w-full bg-purple-600 text-white shadow-lg shadow-purple-500/20 transition-all duration-300 hover:bg-purple-700 hover:shadow-purple-500/40 sm:w-auto"
                />
            </div>

            <div className="pointer-events-none absolute inset-y-0 end-0 w-32 rounded-full bg-purple-500/10 blur-2xl dark:bg-purple-400/5" />
        </section>
    );
}
