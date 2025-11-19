import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CipherText } from '@/components/CipherText';
import { Message, GameState } from '@/hooks/useGameLogic';

type ChatAreaProps = {
    messages: Message[];
    user: any;
    game: GameState;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
};

export function ChatArea({ messages, user, game, messagesEndRef }: ChatAreaProps) {

    const getInitials = (name: string) => {
        return name
            ?.split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || '??';
    };

    const getAvatarColor = (name: string) => {
        const colors = [
            'bg-red-500', 'bg-orange-500', 'bg-amber-500',
            'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
            'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500',
            'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500',
            'bg-pink-500', 'bg-rose-500'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    const displayMessages = game.status === 'solving' ? [...messages].reverse() : messages;

    return (
        <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${game.status === 'solving' ? 'flex flex-col-reverse' : ''}`}>
            {displayMessages.map((msg) => {
                const originalIndex = messages.findIndex(m => m.id === msg.id);
                const isActuallyLast = originalIndex === messages.length - 1;

                const isVisible = msg.is_solved || (game.status !== 'solving' && isActuallyLast);
                const isMe = msg.user_id === user?.id;
                const username = msg.profiles?.username || 'User';

                return (
                    <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <Avatar className="w-8 h-8">
                            <AvatarImage src={msg.profiles?.avatar_url} />
                            <AvatarFallback className={`${getAvatarColor(username)} text-white text-xs`}>
                                {getInitials(username)}
                            </AvatarFallback>
                        </Avatar>
                        <div className={`max-w-[70%] p-3 rounded-lg ${isMe ? 'bg-blue-600' : 'bg-gray-700'}`}>
                            <CipherText
                                text={msg.content}
                                visible={isVisible}
                            />
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>
    );
}
