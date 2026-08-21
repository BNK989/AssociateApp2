import { Flame } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Progress } from '@/components/ui/progress';
import { getTeamFlowProgress } from './headerRules';

type SolvingStatsBarProps = {
    teamConsecutiveCorrect: number;
    isFeverMode: boolean;
};

/** Team streak progress and fever state, shown only while solving. */
export function SolvingStatsBar({ teamConsecutiveCorrect, isFeverMode }: SolvingStatsBarProps) {
    const t = useTranslations('GameRoom.Header');

    return (
        <div className="flex justify-between items-center px-4 py-1.5 bg-gray-50 dark:bg-gray-950/50 text-xs border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 flex-1 me-4">
                <div className="relative w-full">
                    {/* Fever pins the bar full rather than showing the wrapped streak. */}
                    <Progress
                        value={isFeverMode ? 100 : getTeamFlowProgress(teamConsecutiveCorrect)}
                        className={`h-1.5 ${isFeverMode ? 'animate-pulse' : ''}`}
                    />

                    {isFeverMode && (
                        // eslint-disable-next-line no-restricted-syntax -- left-1/2 with -translate-x-1/2 is the direction-neutral centering idiom; start-1/2 would break it in RTL.
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase font-black text-orange-500 tracking-widest animate-bounce whitespace-nowrap">
                            {t('fever_mode')}
                        </span>
                    )}
                </div>
            </div>

            <div className={`flex items-center gap-1 font-bold ${isFeverMode ? 'text-orange-500' : 'text-gray-400'}`}>
                <Flame className={`w-3.5 h-3.5 ${isFeverMode ? 'fill-orange-500' : ''}`} />
                <span>{teamConsecutiveCorrect || 0}</span>
            </div>
        </div>
    );
}
