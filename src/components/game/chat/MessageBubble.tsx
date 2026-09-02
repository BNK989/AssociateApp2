import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { CipherText } from '@/components/CipherText';
import type { GameState, Message } from '@/hooks/useGameLogic';
import { getAvatarColor, getInitials } from '@/lib/avatarUtils';
import { deriveMessageFlags, shouldShowStrikeLabel } from './messageFlags';
import {
    AiHintPanel,
    ConnectionScoreBadge,
    ShuffleHintButton,
    StrikeIndicator,
} from './MessageIndicators';
import { MessageContextMenu } from './MessageContextMenu';

/** Below this width the connection badge drops its text label. */
const NARROW_BUBBLE_PX = 120;

type MessageBubbleProps = {
    message: Message;
    isLastMessage: boolean;
    game: GameState;
    currentUserId?: string;
    targetMessageId?: string;
    isShaking: boolean;
    justSolvedPoints?: number;
    isJustSolved: boolean;
    isRevealed: boolean;
    scrambleTrigger?: number;
    activeBubbleWidth: number;
    isAdmin: boolean;
    onForceScramble: (messageId: string) => void;
    onAdminAction: (action: string, messageId: string) => void;
    onTestEndSequence?: () => void;
    onResetGame?: () => void;
};

/** One player message: avatar, ciphered bubble, and its status indicators. */
export function MessageBubble({
    message,
    isLastMessage,
    game,
    currentUserId,
    targetMessageId,
    isShaking,
    justSolvedPoints,
    isJustSolved,
    isRevealed,
    scrambleTrigger,
    activeBubbleWidth,
    isAdmin,
    onForceScramble,
    onAdminAction,
    onTestEndSequence,
    onResetGame,
}: MessageBubbleProps) {
    const flags = deriveMessageFlags({
        message,
        isLastMessage,
        game,
        currentUserId,
        targetMessageId,
        isRevealed,
    });

    const username = message.profiles?.username || 'User';
    const hasAiHint = message.hint_level === 3 || Boolean(message.ai_hint);
    const scramble = () => onForceScramble(message.id);

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    id={`msg-${message.id}`}
                    data-message-id={message.id}
                    className={`flex items-end md:items-start gap-2 ${flags.isMe ? 'flex-row-reverse' : 'flex-row'} ${isShaking ? 'animate-shake' : ''} ${message.ai_hint ? 'my-2' : ''}`}
                >
                    <Avatar className="w-8 h-8">
                        <AvatarImage src={message.profiles?.avatar_url} />
                        <AvatarFallback className={`${getAvatarColor(username)} text-white text-xs`}>
                            {getInitials(username)}
                        </AvatarFallback>
                    </Avatar>

                    <div
                        id={`msg-bubble-${message.id}`}
                        onClick={(e) => {
                            if (flags.canShuffle) {
                                e.stopPropagation();
                                scramble();
                            }
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        className={`relative max-w-[70%] md:max-w-[85%] rounded-lg transition-all duration-300 ${flags.isMe ? 'bg-indigo-600 text-white glow-me' : 'bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white glow-gray'} ${flags.isTarget ? 'target-message-glow' : ''} ${isJustSolved ? 'scale-110 ring-2 ring-green-500 dark:ring-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : ''} ${flags.needsExtraPadding ? 'p-3 pb-5 cursor-pointer hover:ring-2 hover:ring-indigo-400/50' : 'p-3'}`}
                    >
                        <CipherText
                            text={message.content}
                            cipherText={message.cipher_text}
                            visible={flags.isVisible || isRevealed}
                            className={flags.isMe ? 'text-white' : 'text-gray-900 dark:text-white'}
                            isSolving={flags.isTarget}
                            hintLevel={message.hint_level}
                            guesses={message.guesses || []}
                            forceScramble={scrambleTrigger}
                        />

                        {flags.isTarget && typeof message.connection_score === 'number' && (
                            <ConnectionScoreBadge
                                score={message.connection_score}
                                compact={activeBubbleWidth > 0 && activeBubbleWidth < NARROW_BUBBLE_PX}
                            />
                        )}

                        {flags.canShuffle && (
                            <ShuffleHintButton compact={hasAiHint} onShuffle={scramble} />
                        )}

                        {flags.showStrikeIndicator && (
                            <StrikeIndicator
                                strikes={flags.strikes}
                                isCorrect={flags.isCorrect}
                                isFailed={flags.isFailed}
                                showLabel={shouldShowStrikeLabel(message.content)}
                            />
                        )}

                        {hasAiHint && <AiHintPanel hint={message.ai_hint} />}

                        {isJustSolved && justSolvedPoints !== undefined && justSolvedPoints > 0 && (
                            <div className="absolute -top-10 -end-4 text-3xl font-black text-green-500 dark:text-green-400 animate-float-up z-20 drop-shadow-xl whitespace-nowrap pointer-events-none">
                                +{justSolvedPoints}
                            </div>
                        )}
                    </div>
                </div>
            </ContextMenuTrigger>

            {isAdmin && (
                <MessageContextMenu
                    messageId={message.id}
                    isRevealed={isRevealed}
                    onAdminAction={onAdminAction}
                    onForceScramble={scramble}
                    onTestEndSequence={onTestEndSequence}
                    onResetGame={onResetGame}
                />
            )}
        </ContextMenu>
    );
}
