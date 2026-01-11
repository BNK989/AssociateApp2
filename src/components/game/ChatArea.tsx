import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CipherText } from '@/components/CipherText';
import { Message, GameState } from '@/hooks/useGameLogic';
import { generateCipherString } from '@/lib/gameLogic';
import { User } from '@supabase/supabase-js';
import { toast } from "sonner";
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';
import { GAME_CONFIG } from '@/lib/gameConfig';
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
import { FloatingMessage, AnimationData } from './FloatingMessage';
import { GameBackground } from './GameBackground';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Shuffle, X, Check } from "lucide-react";

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
    floatingAnimation?: AnimationData | null;
    onAnimationComplete?: () => void;
    onTestEndSequence?: () => void;
    onResetGame?: () => void;
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
    floatingAnimation,
    onAnimationComplete,
    onTestEndSequence,
    onResetGame
}: ChatAreaProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { isAdmin } = useAdmin();
    const [revealedMessages, setRevealedMessages] = useState<Record<string, boolean>>({});
    const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
    const [scrambleTriggerMap, setScrambleTriggerMap] = useState<Record<string, number>>({});

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
            } else if (game.status === 'completed') {
                // Game Completed: Celebrate by focusing on the last word revealed (justSolvedData)
                // If not available (e.g. page reload), focus on the last message in the list
                const focusId = justSolvedData?.id || (messages.length > 0 ? messages[messages.length - 1].id : null);

                if (focusId) {
                    const focusEl = document.getElementById(`msg-${focusId}`);
                    if (focusEl) {
                        focusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
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
    const prevTargetIdRef = useRef<string | undefined>(undefined);
    const prevMessagesLengthRef = useRef(messages.length);
    const prevGameStatusRef = useRef(game.status);

    useEffect(() => {
        const isNewMessage = messages.length > prevMessagesLengthRef.current;
        const isTargetChange = targetMessage?.id !== prevTargetIdRef.current;
        const isStatusChange = game.status !== prevGameStatusRef.current;

        // Update Refs
        prevMessagesLengthRef.current = messages.length;
        prevTargetIdRef.current = targetMessage?.id;
        prevGameStatusRef.current = game.status;

        // Strict Whitelist: Only scroll on structural changes (New Message, New Target, Mode Change)
        // This implicitly prevents scrolling on simple updates (Hints, Strikes, Points)
        if (isNewMessage || isTargetChange || isStatusChange) {
            scrollToSmart();
        }
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

    const hasTextMessages = messages.filter(m => m.type !== 'system').length > 0;

    const TypingIndicatorsBlock = (
        game.status !== 'solving' && typingUsers && typingUsers.size > 0 ? (
            <div className="flex flex-col gap-2 pt-2 animate-in fade-in duration-300">
                {Array.from(typingUsers).map(typingUserId => {
                    const player = players?.find(p => p.user_id === typingUserId);
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
        ) : null
    );

    return (
        <div className="flex-1 relative flex flex-col overflow-hidden">
            {/* Animated Background */}
            <GameBackground />

            {/* Scrollable Content Area */}
            <div
                ref={containerRef}
                className="relative z-10 flex-1 overflow-y-auto p-4 space-y-4 flex flex-col"
            >
                {/* Typing Indicators (Top - Only when no text messages exist) */}
                {!hasTextMessages && TypingIndicatorsBlock}

                {messages.filter(m => m.type !== 'system').length === 0 && onStartRandom && (
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

                    const strikes = msg.strikes || 0;
                    // robust check: if points are 0 or missing (undefined/null) but solved, treat as give up
                    const isGivenUp = msg.is_solved && (!msg.winner_points || msg.winner_points === 0);
                    // Hide "Failed/X" for daily game start message (it has 0 points but shouldn't look failed)
                    const isDailyStart = game.id === 'daily-game' && isActuallyLast;
                    const isFailed = ((strikes >= 3 && msg.is_solved) || isGivenUp) && !isDailyStart;
                    const isCorrect = msg.is_solved && !isFailed && (msg.winner_points || 0) > 0;
                    const showStrikeIndicator = (strikes > 0 && strikes < 3 && !isVisible) || isFailed || isCorrect;
                    const needsExtraPadding = (msg.hint_level >= 2 && !isVisible && !revealedMessages[msg.id]) || showStrikeIndicator;

                    return (
                        <div key={msg.id}>
                            {msg.type === 'system' ? (
                                <div className="flex justify-center animate-in fade-in zoom-in duration-300">
                                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
                                        {msg.user_id === user?.id && msg.content.includes('joined the game')
                                            ? 'You joined the game'
                                            : msg.content}
                                    </span>
                                </div>
                            ) : (
                                <ContextMenu>
                                    <ContextMenuTrigger asChild>
                                        <div
                                            id={`msg-${msg.id}`}
                                            data-message-id={msg.id}
                                            className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${isShaking ? 'animate-shake' : ''} ${hasHint ? 'my-2' : ''}`}
                                        >
                                            <Avatar className="w-8 h-8">
                                                <AvatarImage src={msg.profiles?.avatar_url} />
                                                <AvatarFallback className={`${getAvatarColor(username)} text-white text-xs`}>
                                                    {getInitials(username)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div
                                                onClick={(e) => {
                                                    if (msg.hint_level >= 2 && !isVisible && !revealedMessages[msg.id]) {
                                                        e.stopPropagation();
                                                        setScrambleTriggerMap(prev => ({ ...prev, [msg.id]: Date.now() }));
                                                    }
                                                }}
                                                onMouseDown={(e) => e.preventDefault()}
                                                className={`relative max-w-[70%] rounded-lg transition-all duration-300 ${isMe ? 'bg-indigo-600 text-white glow-me' : 'bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white glow-gray'} ${game.status === 'solving' && targetMessage?.id === msg.id ? 'target-message-glow' : ''} ${isJustSolved ? 'scale-110 ring-2 ring-green-500 dark:ring-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : ''} ${needsExtraPadding ? 'p-3 pb-5 cursor-pointer hover:ring-2 hover:ring-indigo-400/50' : 'p-3'}`}>
                                                <CipherText
                                                    text={msg.content}
                                                    cipherText={msg.cipher_text}
                                                    visible={isVisible || !!revealedMessages[msg.id]}
                                                    className={isMe ? 'text-white' : 'text-gray-900 dark:text-white'}
                                                    isSolving={game.status === 'solving' && targetMessage?.id === msg.id}
                                                    hintLevel={msg.hint_level}
                                                    guesses={msg.guesses || []}
                                                    forceScramble={scrambleTriggerMap[msg.id]}
                                                />
                                                {(msg.hint_level >= 2 && !isVisible && !revealedMessages[msg.id]) ? (
                                                    <motion.div
                                                        layout
                                                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, height: "auto", scale: 1 }}
                                                        transition={{
                                                            layout: { duration: 0.3, type: "spring", bounce: 0 },
                                                            opacity: { duration: 0.2 }
                                                        }}
                                                        className={`absolute bottom-0.5 left-1 z-10 ${(msg.hint_level === 3 || msg.ai_hint) ? 'scale-75 origin-bottom-left' : ''}`}
                                                    >
                                                        <TooltipProvider delayDuration={0}>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setScrambleTriggerMap(prev => ({ ...prev, [msg.id]: Date.now() }));
                                                                        }}
                                                                        onMouseDown={(e) => e.preventDefault()}
                                                                        className={`flex items-center cursor-pointer p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors active:scale-95 group`}
                                                                    >
                                                                        <Shuffle className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 group-hover:text-indigo-500 transition-all" />
                                                                        {!(msg.hint_level === 3 || msg.ai_hint) && (
                                                                            <motion.span
                                                                                initial={{ width: "auto", opacity: 1, paddingLeft: 4 }}
                                                                                animate={{ width: 0, opacity: 0, paddingLeft: 0 }}
                                                                                transition={{ delay: 3, duration: 0.8, ease: "easeInOut" }}
                                                                                className="overflow-hidden whitespace-nowrap text-[10px] font-medium text-indigo-500/80 dark:text-indigo-400/80 select-none"
                                                                            >
                                                                                Shuffle
                                                                            </motion.span>
                                                                        )}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="left" className="text-xs px-2 py-1">
                                                                    <p>Shuffle letters</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </motion.div>
                                                ) : null}

                                                {/* Strike / Fail / Success Indicator */}
                                                {showStrikeIndicator && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.5 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="absolute bottom-1 right-1 flex items-center gap-1 z-10"
                                                    >
                                                        {isCorrect ? (
                                                            // Success State
                                                            <div className="flex items-center text-green-500 dark:text-green-400 opacity-90" title="Solved">
                                                                <Check className="w-4 h-4" />
                                                            </div>
                                                        ) : isFailed ? (
                                                            // Failed State: Just the X, no text or frame
                                                            <div className="flex items-center text-gray-400 dark:text-gray-500 opacity-80" title="Word Lost">
                                                                <X className="w-4 h-4" />
                                                            </div>
                                                        ) : (
                                                            // Dots State (Strikes < 3)
                                                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded backdrop-blur-[1px]">
                                                                {/* Dots */}
                                                                <div className="flex gap-0.5">
                                                                    {[1, 2, 3].map((i) => {
                                                                        const livesLeft = 3 - strikes;
                                                                        const isFilled = i <= livesLeft;
                                                                        // 1 life left (2 strikes) -> Warning color
                                                                        const isWarning = livesLeft === 1;

                                                                        return (
                                                                            <div
                                                                                key={i}
                                                                                className={`w-1.5 h-1.5 rounded-full shadow-[0_0_1px_rgba(0,0,0,0.2)] ${isFilled
                                                                                    ? (isWarning ? 'bg-orange-500 shadow-[0_0_4px_rgba(249,115,22,0.6)]' : 'bg-white dark:bg-gray-200')
                                                                                    : 'bg-black/10 dark:bg-white/10'
                                                                                    }`}
                                                                            />
                                                                        );
                                                                    })}
                                                                </div>

                                                                {/* Text Label */}
                                                                {/* Text Label - Hide if message is short (adaptive UI) */}
                                                                {(msg.content.length >= 10) && (
                                                                    <motion.span
                                                                        initial={{ width: "auto", opacity: 1, paddingLeft: 4 }}
                                                                        animate={{ width: 0, opacity: 0, paddingLeft: 0 }}
                                                                        transition={{ delay: 3, duration: 0.8, ease: "easeInOut" }}
                                                                        className="overflow-hidden whitespace-nowrap text-[10px] font-medium text-gray-600 dark:text-gray-300 select-none"
                                                                    >
                                                                        {strikes === 1 ? "2 guesses remain" : "last guess"}
                                                                    </motion.span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                )}
                                                {/* Unified AI Hint / Loading Area */}
                                                {(msg.hint_level === 3 || msg.ai_hint) && (
                                                    <motion.div
                                                        layout
                                                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, height: "auto", scale: 1 }}
                                                        transition={{
                                                            layout: { duration: 0.3, type: "spring", bounce: 0 },
                                                            opacity: { duration: 0.2 }
                                                        }}
                                                        className={`mt-2 text-xs font-medium p-2 rounded border overflow-hidden ${msg.ai_hint
                                                            ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800'
                                                            : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
                                                            }`}
                                                    >
                                                        {!msg.ai_hint ? (
                                                            <div className="flex items-center gap-2 h-5">
                                                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                                <span className="ml-1">Consulting AI...</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-start gap-1.5 animate-in fade-in duration-300">
                                                                <span className="text-base leading-none select-none">💡</span>
                                                                <span className="leading-snug">{msg.ai_hint}</span>
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                )}
                                                {isJustSolved && justSolvedData && justSolvedData.points > 0 && (
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
                                            {onTestEndSequence && (
                                                <>
                                                    <div className="h-px bg-gray-200 dark:bg-gray-800 my-1" />
                                                    <ContextMenuItem
                                                        onClick={() => onTestEndSequence()}
                                                        className="text-purple-600 focus:bg-gray-800 focus:text-purple-500 cursor-pointer font-bold"
                                                    >
                                                        Test End Sequence
                                                    </ContextMenuItem>
                                                </>
                                            )}
                                            <ContextMenuItem
                                                onClick={() => setScrambleTriggerMap(prev => ({ ...prev, [msg.id]: Date.now() }))}
                                                className="text-blue-600 focus:bg-gray-800 focus:text-blue-500 cursor-pointer font-bold"
                                            >
                                                Test Scramble Effect
                                            </ContextMenuItem>
                                            {onResetGame && (
                                                <ContextMenuItem
                                                    onClick={() => {
                                                        if (confirm('Are you sure you want to completely reset this daily game?')) {
                                                            onResetGame();
                                                        }
                                                    }}
                                                    className="text-orange-600 focus:bg-gray-800 focus:text-orange-500 cursor-pointer font-bold"
                                                >
                                                    Reset Game (Debug)
                                                </ContextMenuItem>
                                            )}
                                        </ContextMenuContent>
                                    )}
                                </ContextMenu>
                            )
                            }

                            {
                                showMessageWarning && (
                                    <div className="flex justify-center my-4 animate-in fade-in slide-in-from-bottom-2">
                                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs px-3 py-1 rounded-full shadow-sm font-medium border border-gray-200 dark:border-gray-700">
                                            {messagesLeft === 1 ? 'Last message!' : `${messagesLeft} messages until switching to solve`}
                                        </span>
                                    </div>
                                )
                            }
                        </div >
                    );
                })}
                {/* We keep this ref but don't rely on it for scrolling anymore, or we could remove it if useGameLogic doesn't error */}
                <div ref={messagesEndRef} />

                {/* Typing Indicators (Bottom - Only when text messages exist) */}
                {hasTextMessages && TypingIndicatorsBlock}

                {/* Steal Animation Overlay */}
                {
                    floatingAnimation && (
                        <FloatingMessage
                            data={floatingAnimation}
                            onComplete={() => onAnimationComplete?.()}
                        />
                    )
                }

            </div >
        </div >
    );
}
