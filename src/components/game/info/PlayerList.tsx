import { Trophy, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Player } from '@/hooks/useGameLogic';

type PlayerListProps = {
    players: Player[];
    currentUserId?: string;
};

/** Classic-mode scoreboard, highest score first. */
export function PlayerList({ players, currentUserId }: PlayerListProps) {
    const t = useTranslations('GameRoom.Info');

    const maxScore = Math.max(0, ...players.map((p) => p.score || 0));
    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4" /> {t('players_title')}
            </h3>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 shadow-sm">
                {sorted.map((player) => {
                    const isMe = player.user_id === currentUserId;
                    const isLeader = player.score === maxScore && maxScore > 0;

                    return (
                        <div key={player.user_id} className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-3">
                                <Avatar className={cn('w-10 h-10 border-2', isMe ? 'border-blue-500' : 'border-transparent')}>
                                    <AvatarImage src={player.profiles?.avatar_url} />
                                    <AvatarFallback className="bg-gray-200 dark:bg-gray-800 text-xs">
                                        {player.profiles?.username?.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex flex-col">
                                    <span className="text-sm font-bold flex items-center gap-1.5">
                                        {player.profiles?.username}
                                        {isMe && (
                                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-bold">
                                                {t('you_tag')}
                                            </span>
                                        )}
                                        {isLeader && <Trophy className="w-3 h-3 text-amber-500 fill-amber-500" />}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {player.has_left ? t('status_left') : t('status_active')}
                                    </span>
                                </div>
                            </div>

                            <div className="font-mono font-bold text-lg text-gray-700 dark:text-gray-300">
                                {player.score || 0}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
