import { Dices } from 'lucide-react';
import { useTranslations } from 'next-intl';

type ChatEmptyStateProps = {
    onStartRandom: () => void;
};

/** Shown before the first word is sent: seed the chain, or start typing. */
export function ChatEmptyState({ onStartRandom }: ChatEmptyStateProps) {
    const t = useTranslations('GameRoom.Chat');

    return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-[50vh] animate-in fade-in zoom-in duration-500">
            <div className="text-center space-y-2 opacity-80">
                <p className="text-xl font-bold text-gray-700 dark:text-gray-300">{t('start_title')}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('start_desc')}</p>
            </div>

            <button
                onClick={onStartRandom}
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-full shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center gap-2"
            >
                <Dices className="w-5 h-5" aria-hidden="true" />
                {t('start_random')}
            </button>

            <div className="flex items-center gap-3 w-1/2 opacity-50">
                <div className="h-px bg-gray-400 flex-1" />
                <span className="text-xs font-mono text-gray-500">{t('start_type')}</span>
                <div className="h-px bg-gray-400 flex-1" />
            </div>
        </div>
    );
}
