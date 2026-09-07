import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { CipherText } from '@/components/CipherText';
import type { GameState, Message } from '@/hooks/useGameLogic';
import { getAvatarColor, getInitials } from '@/lib/avatarUtils';
import { deriveMessageFlags, shouldShowStrikeLabel } from './messageFlags';
import { DEFAULT_LEGEND_SAMPLES, hasColouredTiles, pickLegendSamples } from './legendRules';
import { useLegendIntro } from './useLegendIntro';
import { HintPanel } from './HintPanel';
import { InlineLegend } from './InlineLegend';
import {
    ConnectionScoreBadge,
    ShuffleHintButton,
    StrikeIndicator,
} from './MessageIndicators';
import { MessageContextMenu } from './MessageContextMenu';
import { SolveBurst } from './SolveBurst';
import { solvedRingClass } from './solveBurstStyles';
import {
    DEFAULT_FEEDBACK_POLICY,
    shouldBurst,
    type DailyFeedbackPolicy,
} from '@/lib/daily/feedbackPolicy';
import { UNGRADED_FEEDBACK, type JustSolved } from '@/lib/daily/feedbackTiers';

/** Below this width the connection badge drops its text label. */
const NARROW_BUBBLE_PX = 120;

type MessageBubbleProps = {
    message: Message;
    isLastMessage: boolean;
    game: GameState;
    currentUserId?: string;
    targetMessageId?: string;
    isShaking: boolean;
    /** Set for the ~1.5s after this word was solved; null the rest of the time. */
    justSolved?: JustSolved | null;
    /** How rewarding the flourish is allowed to be. Defaults to the compiled floor. */
    feedbackPolicy?: DailyFeedbackPolicy;
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
    justSolved,
    feedbackPolicy = DEFAULT_FEEDBACK_POLICY,
    isRevealed,
    scrambleTrigger,
    activeBubbleWidth,
    isAdmin,
    onForceScramble,
    onAdminAction,
    onTestEndSequence,
    onResetGame,
}: MessageBubbleProps) {
    // Classic multiplayer does not grade solves, so an ungraded one renders at
    // the middle tier -- exactly the flourish it had before grading existed.
    const feedback = justSolved?.feedback ?? UNGRADED_FEEDBACK;
    const isJustSolved = Boolean(justSolved);

    const flags = deriveMessageFlags({
        message,
        isLastMessage,
        game,
        currentUserId,
        targetMessageId,
        isRevealed,
    });

    // The colour key teaches itself on the word being solved, the first time that
    // word actually has a colour to explain.
    const guesses = message.guesses || [];
    const showsColour = flags.isTarget && !flags.isVisible && hasColouredTiles({
        text: message.content,
        cipherText: message.cipher_text,
        guesses,
        hintLevel: message.hint_level,
    });
    const legendIntro = useLegendIntro({
        active: showsColour,
        hintLevel: message.hint_level,
        guessCount: guesses.length,
    });

    // The key explains itself with this word's own tiles rather than stand-in
    // letters, so there is nothing to map from the sample onto the board. Kept
    // for as long as the word is the target rather than only while the key is
    // open, so the samples do not revert to `A`/`B` mid close-animation.
    const legendSamples = flags.isTarget
        ? pickLegendSamples({
            text: message.content,
            cipherText: message.cipher_text,
            guesses,
            hintLevel: message.hint_level,
        })
        : DEFAULT_LEGEND_SAMPLES;

    const username = message.profiles?.username || 'User';
    const scramble = () => onForceScramble(message.id);

    // Only a shuffleable bubble is actually clickable. The reserved strip at the
    // bottom is also there for the strike dots and the outcome mark, and those
    // do nothing when tapped — pointing a cursor at them promised an
    // interaction that was never wired.
    const isClickable = flags.canShuffle;

    // A settled word's outcome, drawn as a spine down the leading edge so the
    // chain can be scanned for wins and losses without reading every mark.
    const outcomeSpine = flags.stage !== 'settled'
        ? ''
        : flags.isCorrect
            ? 'border-s-2 border-green-500/60'
            : flags.isFailed
                ? 'border-s-2 border-gray-400/50 dark:border-gray-500/50'
                : '';

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    id={`msg-${message.id}`}
                    data-message-id={message.id}
                    className={`flex items-end md:items-start gap-2 ${flags.isMe ? 'flex-row-reverse' : 'flex-row'} ${isShaking ? 'animate-shake' : ''} ${flags.hintDisplay === 'open' ? 'my-2' : ''}`}
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
                        className={`relative max-w-[70%] md:max-w-[85%] rounded-lg transition-all duration-300 ${flags.isMe ? 'tile-surface-own bg-indigo-600 text-white glow-me' : 'bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white glow-gray'} ${flags.isTarget ? 'target-message-glow' : ''} ${outcomeSpine} ${flags.isDimmed ? 'opacity-60 hover:opacity-100' : ''} ${isJustSolved ? solvedRingClass(feedback.tier) : ''} ${flags.needsExtraPadding ? 'p-3 pb-5' : 'p-3'} ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-indigo-400/50' : ''}`}
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

                        <InlineLegend
                            open={legendIntro.isOpen}
                            positionNote={message.hint_level >= 2 ? 'shuffled' : 'ordered'}
                            samples={legendSamples}
                            onDismiss={legendIntro.dismiss}
                        />

                        {flags.canShuffle && (
                            <ShuffleHintButton compact={flags.hintDisplay === 'open'} onShuffle={scramble} />
                        )}

                        {flags.showStrikeIndicator && (
                            <StrikeIndicator
                                strikes={flags.strikes}
                                isCorrect={flags.isCorrect}
                                isFailed={flags.isFailed}
                                showLabel={shouldShowStrikeLabel(message.content)}
                            />
                        )}

                        <HintPanel display={flags.hintDisplay} hint={message.ai_hint} />

                        {justSolved && justSolved.points > 0 && (
                            <SolveBurst
                                points={justSolved.points}
                                tier={feedback.tier}
                                streakStep={feedback.streakStep}
                                intensity={feedback.intensity}
                                flourish={feedbackPolicy.flourish}
                                withSparks={shouldBurst(feedbackPolicy, feedback.tier)}
                            />
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
