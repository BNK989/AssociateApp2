import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CipherText } from '@/components/CipherText';
import { Message, GameState } from '@/hooks/useGameLogic';
import { generateCipherString } from '@/lib/gameLogic';
import { User } from '@supabase/supabase-js';
import { toast } from "sonner";
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    ContextMenuSub,
    ContextMenuSubTrigger,
    ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { TypingIndicator } from '../ui/TypingIndicator';
import { StealAnimation } from './StealAnimation';
import { GameBackground } from './GameBackground';

type ChatAreaProps = {
    messages: Message[];
    user: User | null;
    game: GameState;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    targetMessage?: Message;
    shakeMessageId?: string | null;
    justSolvedData?: { id: string; points: number } | null;
    onStartRandom?: () => void;
    typingUsers?: Set<string>;
    players?: any[];
    stealData?: { stealerName: string; stealerAvatar?: string; authorName?: string } | null;
    onStealAnimationComplete?: () => void;
};

export function ChatArea({
    messages,
    user,
    game,
    messagesEndRef,
    targetMessage,
    shakeMessageId,
    justSolvedData,
    onStartRandom,
    typingUsers,
    players,
    stealData,
    onStealAnimationComplete
}: ChatAreaProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { isAdmin } = useAdmin();
    const [revealedMessages, setRevealedMessages] = useState<Record<string, boolean>>({});

    const handleAdminAction = async (action: string, messageId: string) => {
        try {
            if (action === 'delete') {
                if (!confirm('Delete this message?')) return;
                const { error } = await supabase.from('messages').delete().eq('id', messageId);
                if (error) throw error;
                toast.success('Message deleted');
            } else if (action === 'show_content') {
                setRevealedMessages(prev => ({ ...prev, [messageId]: !prev[messageId] }));
            } else if (action.startsWith('hint_')) {
                // Call API to trigger hint
                const hintType = action.replace('hint_', '');
                const response = await fetch(`/api/game/${game.id}/action`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'hint',
                        hintType: hintType, // '1', '2', or '3'
                        userId: user?.id
                    })
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to trigger hint');
                }
                toast.success(`Hint ${hintType} triggered`);
            }
        } catch (error: any) {
            console.error(`Admin action ${action} failed:`, error);
            toast.error(`Action failed: ${error.message}`);
        }
    };

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
                    // Input area is roughly 60px, but now we are just scrolling relative to this container
                    const bottomPadding = 20;
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

    // Scroll on typing
    useEffect(() => {
        if (typingUsers && typingUsers.size > 0) {
            scrollToSmart();
        }
    }, [typingUsers]);

    // Scroll on resize (keyboard open)
    useEffect(() => {
        if (!window.visualViewport) return;

        const handleResize = () => {
            scrollToSmart();
        };

        window.visualViewport.addEventListener('resize', handleResize);
        return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }, [game.status, targetMessage]);

    // Celebrate when switching to solving mode
    const prevStatusRef = useRef(game.status);

    useEffect(() => {
        // Only trigger if we TRANSITION to solving (not if we load in solving)
        if (game.status === 'solving' && prevStatusRef.current !== 'solving') {
            import('canvas-confetti').then((confetti) => {
                const duration = 1000; // Halved from 2000ms
                const end = Date.now() + duration;

                (function frame() {
                    confetti.default({
                        particleCount: 5,
                        angle: 60,
                        spread: 55,
                        origin: { x: 0 },
                        colors: ['#bb0000', '#ffffff', '#0000ff']
                    });
                    confetti.default({
                        particleCount: 5,
                        angle: 120,
                        spread: 55,
                        origin: { x: 1 },
                        colors: ['#bb0000', '#ffffff', '#0000ff']
                    });

                    if (Date.now() < end) {
                        requestAnimationFrame(frame);
                    }
                })();
            });
        }
        prevStatusRef.current = game.status;
    }, [game.status]);

    return (
        <div className="flex-1 relative flex flex-col overflow-hidden">
            {/* Animated Background */}
            <GameBackground />

            {/* Scrollable Content Area */}
            <div
                ref={containerRef}
                className="relative z-10 flex-1 overflow-y-auto p-4 space-y-4 flex flex-col"
            >
                {messages.length === 0 && onStartRandom && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-[50vh] animate-in fade-in zoom-in duration-500">
                        <div className="text-center space-y-2 opacity-80">
                            <p className="text-xl font-bold text-gray-700 dark:text-gray-300">Start the Game!</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Be the first to send a message or start with a random word.</p>
                        </div>
                        <button
                            onClick={onStartRandom}
                            className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-full shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center gap-2"
                        >
                            <span>🎲</span> Start with Random Word
                        </button>
                        {/* Or Separator */}
                        <div className="flex items-center gap-3 w-1/2 opacity-50">
                            <div className="h-px bg-gray-400 flex-1" />
                            <span className="text-xs font-mono text-gray-500">OR TYPE BELOW</span>
                            <div className="h-px bg-gray-400 flex-1" />
                        </div>
                    </div>
                )}

                {displayMessages.map((msg) => {
                    const originalIndex = messages.findIndex(m => m.id === msg.id);
                    const isActuallyLast = originalIndex === messages.length - 1;

                    const isVisible = msg.is_solved || (game.status !== 'solving' && isActuallyLast);
                    const isMe = msg.user_id === user?.id;
                    const username = msg.profiles?.username || 'User';
                    const isShaking = shakeMessageId === msg.id;
                    const isJustSolved = justSolvedData?.id === msg.id;
                    const hasHint = !!msg.ai_hint;

                    // Message Count Logic for System Notification
                    let showMessageWarning = false;
                    let messagesLeft = -1;

                    if (game.status !== 'solving' && game.max_messages) {
                        const messageIndex = messages.findIndex(m => m.id === msg.id); // Get true index (0-based)
                        const countSoFar = messageIndex + 1;
                        messagesLeft = game.max_messages - countSoFar;

                        // Show bubble if 3, 2, or 1 messages left
                        if (messagesLeft < 4 && messagesLeft > 0) {
                            showMessageWarning = true;
                        }
                    }

                    return (
                        <div key={msg.id}>
                            {msg.type === 'system' ? (
                                <div className="flex justify-center my-4 animate-in fade-in zoom-in duration-300">
                                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
                                        {msg.content}
                                    </span>
                                </div>
                            ) : (
                                <ContextMenu>
                                    <ContextMenuTrigger asChild>
                                        <div
                                            id={`msg-${msg.id}`}
                                            data-message-id={msg.id}
                                            className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${isShaking ? 'animate-shake' : ''} ${hasHint ? 'my-6' : ''}`}
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
                                                    visible={isVisible || !!revealedMessages[msg.id]}
                                                    className={isMe || isJustSolved ? 'text-white' : 'text-gray-900 dark:text-white'}
                                                    isSolving={game.status === 'solving' && targetMessage?.id === msg.id && (typingUsers?.size ?? 0) > 0}
                                                />
                                                {msg.ai_hint && (
                                                    <div className="mt-2 text-xs font-medium text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40 p-2 rounded border border-yellow-200 dark:border-yellow-800 animate-in fade-in slide-in-from-top-1">
                                                        💡 Hint: {msg.ai_hint}
                                                    </div>
                                                )}
                                                {isJustSolved && justSolvedData && (
                                                    <div className="absolute -top-10 -right-4 text-3xl font-black text-green-500 dark:text-green-400 animate-float-up z-20 drop-shadow-xl whitespace-nowrap pointer-events-none">
                                                        +{justSolvedData.points}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </ContextMenuTrigger>
                                    {isAdmin && (
                                        <ContextMenuContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                                            <ContextMenuItem onClick={() => handleAdminAction('show_content', msg.id)} className="cursor-pointer">
                                                {revealedMessages[msg.id] ? 'Hide Content' : 'Reveal Content'}
                                            </ContextMenuItem>
                                            <ContextMenuSub>
                                                <ContextMenuSubTrigger disabled className="cursor-not-allowed text-gray-400">Trigger Hint (Disabled)</ContextMenuSubTrigger>
                                                <ContextMenuSubContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                                                    <ContextMenuItem disabled className="cursor-not-allowed">Hint 1</ContextMenuItem>
                                                </ContextMenuSubContent>
                                            </ContextMenuSub>
                                            <div className="h-px bg-gray-200 dark:bg-gray-800 my-1" />
                                            <ContextMenuItem
                                                onClick={() => handleAdminAction('delete', msg.id)}
                                                className="text-red-600 focus:bg-gray-800 focus:text-red-500 cursor-pointer font-bold"
                                            >
                                                Delete Message
                                            </ContextMenuItem>
                                        </ContextMenuContent>
                                    )}
                                </ContextMenu>
                            )}

                            {showMessageWarning && (
                                <div className="flex justify-center my-4 animate-in fade-in slide-in-from-bottom-2">
                                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs px-3 py-1 rounded-full shadow-sm font-medium border border-gray-200 dark:border-gray-700">
                                        {messagesLeft === 1 ? 'Last message!' : `${messagesLeft} messages until switching to solve`}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
                {/* We keep this ref but don't rely on it for scrolling anymore, or we could remove it if useGameLogic doesn't error */}
                <div ref={messagesEndRef} />

                {/* Typing Indicators (only show if NOT in solving mode) */}
                {game.status !== 'solving' && typingUsers && typingUsers.size > 0 && (
                    <div className="flex flex-col gap-2 pt-2 animate-in fade-in duration-300">
                        {Array.from(typingUsers).map(typingUserId => {
                            const player = players?.find(p => p.user_id === typingUserId);
                            // Fallback username if player data missing or just 'Someone'
                            const username = player?.profiles?.username || 'Player';

                            return (
                                <div key={typingUserId} className="flex items-center gap-2">
                                    <Avatar className="w-6 h-6 opacity-70">
                                        <AvatarImage src={player?.profiles?.avatar_url} />
                                        <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">{getInitials(username)}</AvatarFallback>
                                    </Avatar>
                                    <div className="bg-gray-100 dark:bg-neutral-800 rounded-2xl rounded-tl-none px-3 py-2 shadow-sm">
                                        <TypingIndicator />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Steal Animation Overlay */}
                {/* Steal Animation Overlay */}
                {stealData && (
                    <StealAnimation
                        stealerName={stealData.stealerName}
                        stealerAvatar={stealData.stealerAvatar}
                        authorName={stealData.authorName}
                        onComplete={() => onStealAnimationComplete?.()}
                    />
                )}

            </div>
        </div >
    );
}
