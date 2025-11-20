import { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CipherText } from '@/components/CipherText';
import { Message, GameState } from '@/hooks/useGameLogic';

type ChatAreaProps = {
    messages: Message[];
    user: any;
    game: GameState;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    targetMessage?: Message;
};

export function ChatArea({ messages, user, game, messagesEndRef, targetMessage }: ChatAreaProps) {
    const containerRef = useRef<HTMLDivElement>(null);

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

    const displayMessages = messages;

    const scrollToSmart = () => {
        if (!containerRef.current) return;

        // Small timeout to ensure DOM is ready
        setTimeout(() => {
            if (game.status === 'solving' && targetMessage) {
                const targetEl = document.getElementById(`msg-${targetMessage.id}`);
                if (targetEl && containerRef.current) {
                    // Calculate position to show message at bottom of visible area (above input)
                    // Input area + padding is roughly 120px + 20px gap
                    const bottomPadding = 140;
                    const elementBottom = targetEl.offsetTop + targetEl.offsetHeight;
                    const containerHeight = containerRef.current.clientHeight;

                    const scrollTo = elementBottom - containerHeight + bottomPadding;

                    containerRef.current.scrollTo({
                        top: scrollTo,
                        behavior: 'smooth'
                    });
                }
            } else {
                // Normal mode: scroll to bottom
                if (containerRef.current) {
                    containerRef.current.scrollTop = containerRef.current.scrollHeight;
                }
            }
        }, 100);
    };

    // Scroll on messages change
    useEffect(() => {
        scrollToSmart();
    }, [messages, game.status, targetMessage]);

    // Scroll on resize (keyboard open)
    useEffect(() => {
        if (!window.visualViewport) return;

        const handleResize = () => {
            scrollToSmart();
        };

        window.visualViewport.addEventListener('resize', handleResize);
        return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }, [game.status, targetMessage]);

    return (
        <div
            ref={containerRef}
            className="relative h-screen overflow-y-auto pt-16 pb-24 px-4 space-y-4"
        >
            {displayMessages.map((msg) => {
                const originalIndex = messages.findIndex(m => m.id === msg.id);
                const isActuallyLast = originalIndex === messages.length - 1;

                const isVisible = msg.is_solved || (game.status !== 'solving' && isActuallyLast);
                const isMe = msg.user_id === user?.id;
                const username = msg.profiles?.username || 'User';

                return (
                    <div
                        key={msg.id}
                        id={`msg-${msg.id}`}
                        data-message-id={msg.id}
                        className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                    >
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
            {/* We keep this ref but don't rely on it for scrolling anymore, or we could remove it if useGameLogic doesn't error */}
            <div ref={messagesEndRef} />
        </div>
    );
}
