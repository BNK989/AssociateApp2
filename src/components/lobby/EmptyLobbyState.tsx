import { MessageSquarePlus, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

type EmptyLobbyStateProps = {
    onCreateGame: () => void;
};

/** Shown when the player has no active games. */
export function EmptyLobbyState({ onCreateGame }: EmptyLobbyStateProps) {
    const t = useTranslations('Lobby');

    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 text-center animate-in fade-in zoom-in duration-500">
            <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-full mb-6 relative group">
                <Sparkles className="w-10 h-10 text-purple-600 dark:text-purple-400 absolute -top-2 -end-2 animate-pulse" />
                <MessageSquarePlus className="w-12 h-12 text-purple-600 dark:text-purple-400" />
            </div>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('empty.title')}</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8 leading-relaxed">
                {t('empty.description')}
            </p>

            <Button
                onClick={onCreateGame}
                size="lg"
                className="text-lg px-8 py-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-xl shadow-purple-500/20 hover:shadow-purple-500/40 transition-all duration-300 transform hover:scale-105"
            >
                <Sparkles className="w-5 h-5 me-2" />
                {t('empty.button')}
            </Button>
        </div>
    );
}
