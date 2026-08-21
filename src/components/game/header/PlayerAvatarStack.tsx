import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarColor, getInitials } from '@/lib/avatarUtils';
import type { Player } from '@/hooks/useGameLogic';
import { sortPlayersForStack } from './headerRules';

type PlayerAvatarStackProps = {
    players: Player[];
    activePlayerId?: string;
    onClick: () => void;
};

/** Overlapping avatars, with the active player on top and leavers greyed out. */
export function PlayerAvatarStack({ players, activePlayerId, onClick }: PlayerAvatarStackProps) {
    return (
        <div
            className="flex items-center -space-x-2 ms-2 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
            onClick={onClick}
        >
            {sortPlayersForStack(players, activePlayerId).map((player) => {
                const username = player.profiles?.username || '';

                return (
                    <Avatar
                        key={player.user_id}
                        className={`w-8 h-8 border-2 border-white dark:border-gray-900 ${player.user_id === activePlayerId ? 'z-10' : ''} ${player.has_left ? 'opacity-40 grayscale' : ''}`}
                    >
                        <AvatarImage src={player.profiles?.avatar_url} />
                        <AvatarFallback className={`${getAvatarColor(username)} text-white text-xs`}>
                            {getInitials(username)}
                        </AvatarFallback>
                    </Avatar>
                );
            })}
        </div>
    );
}
