import { ArrowRight, Calendar, CheckCircle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

type DailyChallengeCardProps = {
    completed: boolean;
    loading: boolean;
    onOpen: () => void;
};

/** Entry point to today's puzzle, dimmed once it has been played. */
export function DailyChallengeCard({ completed, loading, onOpen }: DailyChallengeCardProps) {
    const t = useTranslations('Lobby');

    return (
        <div className="mb-8 p-1">
            <button
                onClick={onOpen}
                disabled={loading}
                className={`w-full group relative overflow-hidden rounded-2xl border transition-all duration-300 transform hover:scale-[1.01] hover:shadow-xl text-start cursor-pointer ${completed
                    ? 'bg-secondary/50 border-border opacity-80'
                    : 'bg-gradient-to-r from-amber-100 to-orange-100 dark:bg-none dark:bg-gray-900/40 border-orange-200 dark:border-amber-500/20'
                    }`}
            >
                <div className="p-6 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${completed ? 'bg-secondary' : 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/20'}`}>
                            {completed
                                ? <CheckCircle className="w-6 h-6 text-green-500" />
                                : <Calendar className="w-6 h-6" />}
                        </div>

                        <div>
                            <h3 className={`text-lg font-bold ${completed ? 'text-muted-foreground' : 'text-orange-900 dark:text-amber-100'}`}>
                                {completed ? t('daily.completed') : t('daily.title')}
                            </h3>
                            <p className={`text-sm ${completed ? 'text-muted-foreground' : 'text-orange-700 dark:text-gray-400'}`}>
                                {completed ? t('daily.completed_description') : t('daily.description')}
                            </p>
                        </div>
                    </div>

                    {!completed && (
                        <div className="bg-white/80 dark:bg-white/10 p-2 rounded-full transition-opacity transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1">
                            {loading
                                ? <Loader2 className="w-5 h-5 text-orange-600 dark:text-amber-400 animate-spin" />
                                : <ArrowRight className="w-5 h-5 text-orange-600 dark:text-amber-400 rtl:rotate-180" />}
                        </div>
                    )}
                </div>

                {!completed && (
                    // eslint-disable-next-line no-restricted-syntax -- TODO(rtl): decorative blur blob. Paired with a physical translate-x-1/2, so end-0 alone would push it the wrong way in RTL. Needs a design call on whether the ornament should mirror.
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 dark:bg-amber-400/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                )}
            </button>
        </div>
    );
}
