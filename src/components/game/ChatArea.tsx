import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { User } from '@supabase/supabase-js';
import type { GameState, Message, Player } from '@/hooks/useGameLogic';
import { useAdmin } from '@/hooks/useAdmin';
import { FloatingMessage, type AnimationData } from './FloatingMessage';
import { GameBackground } from './GameBackground';
import { ChatEmptyState } from './chat/ChatEmptyState';
import { MessageBubble } from './chat/MessageBubble';
import { SystemMessage } from './chat/SystemMessage';
import { TypingIndicators } from './chat/TypingIndicators';
import { getMessagesLeftWarning } from './chat/messageFlags';
import { useAdminMessageActions } from './chat/useAdminMessageActions';
import { useBubbleWidth } from './chat/useBubbleWidth';
import { useChatScroll } from './chat/useChatScroll';
import { useSolvingConfetti } from './chat/useSolvingConfetti';

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
    players?: Player[];
    floatingAnimation?: AnimationData | null;
    onAnimationComplete?: () => void;
    onTestEndSequence?: () => void;
    onResetGame?: () => void;
};

/**
 * The scrollable message list for both game phases.
 *
 * This component owns layout and scroll position; per-message rendering, the
 * scroll maths, and admin actions live in ./chat.
 */
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
    onResetGame,
}: ChatAreaProps) {
    const t = useTranslations('GameRoom.Chat');
    const containerRef = useRef<HTMLDivElement>(null);
    const { isAdmin } = useAdmin();
    const [scrambleTriggerMap, setScrambleTriggerMap] = useState<Record<string, number>>({});

    const { revealedMessages, handleAdminAction } = useAdminMessageActions(game, user);
    const activeBubbleWidth = useBubbleWidth(game, targetMessage);

    useChatScroll({ containerRef, messages, game, targetMessage, justSolvedData });
    useSolvingConfetti(game);

    const forceScramble = (messageId: string) =>
        setScrambleTriggerMap((prev) => ({ ...prev, [messageId]: Date.now() }));

    const hasTextMessages = messages.some((m) => m.type !== 'system');

    const typingBlock = game.status !== 'solving'
        ? <TypingIndicators typingUsers={typingUsers} players={players} />
        : null;

    return (
        <div className="flex-1 relative flex flex-col overflow-hidden">
            <GameBackground />

            <div
                ref={containerRef}
                className="relative z-10 flex-1 overflow-y-auto p-4 space-y-4 flex flex-col"
            >
                {/* Before any words exist the indicators sit at the top instead. */}
                {!hasTextMessages && typingBlock}

                {!hasTextMessages && onStartRandom && (
                    <ChatEmptyState onStartRandom={onStartRandom} />
                )}

                {messages.map((message, index) => {
                    const isLastMessage = index === messages.length - 1;
                    const messagesLeft = getMessagesLeftWarning(game, index);

                    return (
                        <div key={message.id}>
                            {message.type === 'system' ? (
                                <SystemMessage
                                    content={message.content}
                                    isOwnEvent={message.user_id === user?.id}
                                />
                            ) : (
                                <MessageBubble
                                    message={message}
                                    isLastMessage={isLastMessage}
                                    game={game}
                                    currentUserId={user?.id}
                                    targetMessageId={targetMessage?.id}
                                    isShaking={shakeMessageId === message.id}
                                    isJustSolved={justSolvedData?.id === message.id}
                                    justSolvedPoints={justSolvedData?.points}
                                    isRevealed={Boolean(revealedMessages[message.id])}
                                    scrambleTrigger={scrambleTriggerMap[message.id]}
                                    activeBubbleWidth={activeBubbleWidth}
                                    isAdmin={isAdmin}
                                    onForceScramble={forceScramble}
                                    onAdminAction={handleAdminAction}
                                    onTestEndSequence={onTestEndSequence}
                                    onResetGame={onResetGame}
                                />
                            )}

                            {messagesLeft !== null && (
                                <div className="flex justify-center my-4 animate-in fade-in slide-in-from-bottom-2">
                                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs px-3 py-1 rounded-full shadow-sm font-medium border border-gray-200 dark:border-gray-700">
                                        {messagesLeft === 1
                                            ? t('warning_last')
                                            : t('warning_switch', { count: messagesLeft })}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}

                <div ref={messagesEndRef} />

                {hasTextMessages && typingBlock}

                {floatingAnimation && (
                    <FloatingMessage
                        data={floatingAnimation}
                        onComplete={() => onAnimationComplete?.()}
                    />
                )}
            </div>
        </div>
    );
}
