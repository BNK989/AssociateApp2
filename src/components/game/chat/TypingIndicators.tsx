import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TypingIndicator } from '@/components/ui/TypingIndicator';
import type { Player } from '@/hooks/useGameLogic';
import { getInitials } from '@/lib/avatarUtils';

type TypingIndicatorsProps = {
    typingUsers?: Set<string>;
    players?: Player[];
};

/** Avatar + bubble for each player currently typing. Renders nothing if none are. */
export function TypingIndicators({ typingUsers, players }: TypingIndicatorsProps) {
    if (!typingUsers || typingUsers.size === 0) return null;

    return (
        <div className="flex flex-col gap-2 pt-2 animate-in fade-in duration-300">
            {Array.from(typingUsers).map((typingUserId) => {
                const player = players?.find((p) => p.user_id === typingUserId);
                const username = player?.profiles?.username || 'Player';

                return (
                    <div key={typingUserId} className="flex items-center gap-2">
                        <Avatar className="w-6 h-6 opacity-70">
                            <AvatarImage src={player?.profiles?.avatar_url} />
                            <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                                {getInitials(username)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="bg-gray-100 dark:bg-neutral-800 rounded-2xl rounded-ss-none px-3 py-2 shadow-sm">
                            <TypingIndicator />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
