import { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CipherText } from '@/components/CipherText';
import { Message, GameState } from '@/hooks/useGameLogic';
import { User } from '@supabase/supabase-js';

type ChatAreaProps = {
    messages: Message[];
    user: User | null;
    game: GameState;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    targetMessage?: Message;
    shakeMessageId?: string | null;
    justSolvedData?: { id: string; points: number } | null;
};

export function ChatArea({ messages, user, game, messagesEndRef, targetMessage, shakeMessageId, justSolvedData }: ChatAreaProps) {
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
            className="relative h-screen overflow-y-auto pt-16 pb-24 px-4 space-y-4 bg-gray-200 dark:bg-neutral-900"
        >
            {displayMessages.map((msg) => {
                const originalIndex = messages.findIndex(m => m.id === msg.id);
                const isActuallyLast = originalIndex === messages.length - 1;

                const isVisible = msg.is_solved || (game.status !== 'solving' && isActuallyLast);
                const isMe = msg.user_id === user?.id;
                const username = msg.profiles?.username || 'User';
                const isShaking = shakeMessageId === msg.id;
                const isJustSolved = justSolvedData?.id === msg.id;

                return (
                    <div
                        key={msg.id}
                        id={`msg-${msg.id}`}
                        data-message-id={msg.id}
                        className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${isShaking ? 'animate-shake' : ''}`}
                    >
                        <Avatar className="w-8 h-8">
                            <AvatarImage src={msg.profiles?.avatar_url} />
                            <AvatarFallback className={`${getAvatarColor(username)} text-white text-xs`}>
                                {getInitials(username)}
                            </AvatarFallback>
                        </Avatar>
                        <div className={`relative max-w-[70%] p-3 rounded-lg transition-all duration-300 ${isMe ? 'bg-indigo-600 text-white glow-me' : 'bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white glow-gray'} ${game.status === 'solving' && targetMessage?.id === msg.id ? 'target-message-glow' : ''} ${isJustSolved ? 'scale-110 bg-green-500 text-white ring-4 ring-green-300 dark:ring-green-900' : ''}`}>
                            <CipherText
                                text={msg.content}
                                cipherText={msg.cipher_text}
                                visible={isVisible}
                                className={isMe || isJustSolved ? 'text-white' : 'text-gray-900 dark:text-white'}
                            />
                            {isJustSolved && justSolvedData && (
                                <div className="absolute -top-10 -right-4 text-3xl font-black text-green-500 dark:text-green-400 animate-float-up z-20 drop-shadow-xl whitespace-nowrap pointer-events-none">
                                    +{justSolvedData.points}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            {/* We keep this ref but don't rely on it for scrolling anymore, or we could remove it if useGameLogic doesn't error */}
            <div ref={messagesEndRef} />
        </div>
    );
}
