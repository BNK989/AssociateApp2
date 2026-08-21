import { Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GameState } from '@/hooks/useGameLogic';

type ScoreSummaryProps = {
    game: GameState;
    isDaily: boolean;
    myScore: number;
    solvedCount?: number;
};

type StatCardProps = {
    label: string;
    tone: 'purple' | 'blue' | 'green';
    children: React.ReactNode;
};

const TONES = {
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/50',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/50',
} as const;

const LABEL_TONES = {
    purple: 'text-purple-600 dark:text-purple-400',
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
} as const;

const VALUE_TONES = {
    purple: 'text-purple-700 dark:text-purple-300',
    blue: 'text-blue-700 dark:text-blue-300',
    green: 'text-green-700 dark:text-green-300',
} as const;

function StatCard({ label, tone, children }: StatCardProps) {
    return (
        <div className={`${TONES[tone]} p-4 rounded-xl border flex flex-col items-center justify-center text-center`}>
            <span className={`text-xs ${LABEL_TONES[tone]} font-bold uppercase mb-1`}>{label}</span>
            <span className={`text-3xl font-black ${VALUE_TONES[tone]}`}>{children}</span>
        </div>
    );
}

/** Team pot and personal score (classic), or score and solved count (daily). */
export function ScoreSummary({ game, isDaily, myScore, solvedCount }: ScoreSummaryProps) {
    const t = useTranslations('GameRoom.Info');

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Trophy className="w-4 h-4" /> {t('scores_title')}
            </h3>

            <div className="grid grid-cols-2 gap-3">
                {!isDaily && (
                    <StatCard label={t('team_pot')} tone="purple">{game.team_pot || 0}</StatCard>
                )}

                <StatCard label={t('your_score')} tone="blue">{myScore}</StatCard>

                {isDaily && (
                    <StatCard label={t('solved')} tone="green">
                        {solvedCount || 0}
                        <span className="text-lg opacity-50">/{game.max_messages || 0}</span>
                    </StatCard>
                )}
            </div>
        </div>
    );
}
