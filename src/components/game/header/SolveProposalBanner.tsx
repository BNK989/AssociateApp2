import { useTranslations } from 'next-intl';
import type { Player } from '@/hooks/useGameLogic';
import { countActivePlayers } from './headerRules';

type SolveProposalBannerProps = {
    players: Player[];
    confirmations: string[];
    currentUserId?: string;
    secondsLeft: number | null;
    onConfirm: () => void;
    onDeny: () => void;
};

/** Vote banner shown while a switch to solving is pending. */
export function SolveProposalBanner({
    players,
    confirmations,
    currentUserId,
    secondsLeft,
    onConfirm,
    onDeny,
}: SolveProposalBannerProps) {
    const t = useTranslations('GameRoom.Header');
    const hasConfirmed = confirmations.includes(currentUserId ?? '');

    return (
        <div className="absolute top-full start-0 w-full bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2 flex justify-between items-center z-10 shadow-lg text-gray-900 dark:text-white">
            <div className="flex flex-col">
                <span className="text-sm font-bold">{t('switch_solving')}</span>
                <span className="text-xs opacity-70">
                    {confirmations.length}/{countActivePlayers(players)} {t('agreed')} ({secondsLeft}s)
                </span>
            </div>

            <div className="flex gap-2">
                {hasConfirmed ? (
                    <button
                        disabled
                        className="px-3 py-1 bg-gray-400 dark:bg-gray-600 rounded text-xs font-bold text-white cursor-not-allowed"
                    >
                        {t('confirmed')}
                    </button>
                ) : (
                    <button
                        onClick={onConfirm}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-bold text-white transition-colors"
                    >
                        {t('confirm')}
                    </button>
                )}

                <button
                    onClick={onDeny}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-bold text-white transition-colors"
                >
                    {t('deny')}
                </button>
            </div>
        </div>
    );
}
