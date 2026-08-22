import { useState } from 'react';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import type { User } from '@supabase/supabase-js';
import { InvitePlayer } from '@/components/InvitePlayer';
import type { GameState, Message, Player } from '@/hooks/useGameLogic';
import { InfoScreen } from './InfoScreen';
import { LeaveGameConfirm } from './header/LeaveGameConfirm';
import { PlayerAvatarStack } from './header/PlayerAvatarStack';
import { ScoreCounter } from './header/ScoreCounter';
import { SolveProposalBanner } from './header/SolveProposalBanner';
import { SolvingStatsBar } from './header/SolvingStatsBar';
import { WelcomeOverlay } from './header/WelcomeOverlay';
import { getActivePlayerId, isScoreLeader } from './header/headerRules';
import { useWelcomeOverlay } from './header/useWelcomeOverlay';

/** Below this many messages a game still needs players more than it needs solving. */
const MIN_MESSAGES_BEFORE_SOLVE = 5;

type GameHeaderProps = {
    game: GameState;
    user: User | null;
    players: Player[];
    /** @deprecated Accepted for compatibility; the header does not read it. */
    loading?: boolean;
    proposalTimeLeft: number | null;
    /** @deprecated Accepted for compatibility; the header does not read it. */
    solvingTimeLeft?: number | null;
    targetMessage?: Message;
    messageCount: number;
    maxMessages?: number;
    onBack: () => void;
    /** @deprecated Accepted for compatibility; the header does not read it. */
    onRefresh?: () => void;
    onProposeSolving: () => void;
    onConfirmSolving: () => void;
    onDenySolving: () => void;
    onLeave?: () => void;
    skipExitConfirm?: boolean;
    theme?: string;
    /** Prebuilt spoiler-free result, forwarded to the info screen's share button. */
    shareText?: string;
    hideBank?: boolean;
    hideAvatars?: boolean;
    date?: string;
    solvedCount?: number;
    onWelcomeComplete?: () => void;
    showTutorial?: boolean;
    /** When provided the parent owns InfoScreen visibility; otherwise it is local. */
    externalShowInfo?: boolean;
    onInfoToggle?: (open: boolean) => void;
    onRestartTutorial?: () => void;
    onAutoHintChange?: (enabled: boolean, duration: number) => void;
};

/**
 * Game chrome: who is playing, the score, and the controls for moving between
 * phases. Also hosts the InfoScreen and welcome overlays.
 */
export function GameHeader({
    game,
    user,
    players,
    proposalTimeLeft,
    targetMessage,
    messageCount,
    maxMessages,
    onBack,
    onProposeSolving,
    onConfirmSolving,
    onDenySolving,
    onLeave,
    skipExitConfirm,
    theme,
    shareText,
    hideBank,
    hideAvatars,
    date,
    solvedCount,
    onWelcomeComplete,
    showTutorial,
    externalShowInfo,
    onInfoToggle,
    onRestartTutorial,
    onAutoHintChange,
}: GameHeaderProps) {
    const t = useTranslations('GameRoom.Header');

    const [isProposing, setIsProposing] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [internalShowInfo, setInternalShowInfo] = useState(false);

    const showWelcome = useWelcomeOverlay(theme, showTutorial, onWelcomeComplete);

    const isSolving = game.status === 'solving';
    const isFeverMode = (game.fever_mode_remaining || 0) > 0;
    const myScore = players.find((p) => p.user_id === user?.id)?.score || 0;

    const isInfoOpen = externalShowInfo !== undefined ? externalShowInfo : internalShowInfo;
    const toggleInfo = (open: boolean) => {
        if (onInfoToggle) onInfoToggle(open);
        else setInternalShowInfo(open);
    };

    const handleBackClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const isFinished = game.status === 'completed' || game.status === 'lobby';

        if (!skipExitConfirm && !isFinished) setShowLeaveConfirm(true);
        else onBack();
    };

    const handlePropose = async () => {
        setIsProposing(true);
        try {
            await onProposeSolving();
        } finally {
            setIsProposing(false);
        }
    };

    return (
        <header
            id="daily-game-header"
            className={`relative shrink-0 z-20 w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 transition-colors duration-500 ${isFeverMode ? 'dark:bg-orange-950/30' : ''}`}
        >
            <WelcomeOverlay show={showWelcome} theme={theme} />

            <div className="p-2 flex justify-between items-center relative">
                <div className={`flex items-center gap-3 ${theme ? 'flex-1 min-w-0 me-4' : 'w-1/3'}`}>
                    <button
                        onClick={handleBackClick}
                        className="p-2 -ms-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-900 dark:text-white shrink-0"
                        aria-label={t('go_home')}
                    >
                        <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                    </button>

                    {!hideAvatars && (
                        <PlayerAvatarStack
                            players={players}
                            activePlayerId={getActivePlayerId(game, targetMessage)}
                            onClick={() => toggleInfo(true)}
                        />
                    )}

                    {theme && (
                        <div
                            className={`flex flex-col items-start ms-1 cursor-pointer hover:opacity-70 transition-opacity min-w-0 flex-1 ${showWelcome ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                            onClick={() => toggleInfo(true)}
                        >
                            {/* Shares layoutId with the welcome overlay so the theme flies into place. */}
                            <motion.span
                                layoutId="theme-text"
                                className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white leading-tight break-words w-full"
                            >
                                {theme}
                            </motion.span>
                        </div>
                    )}
                </div>

                <ScoreCounter
                    score={myScore}
                    teamPot={game.team_pot || 0}
                    isLeader={isScoreLeader(players, user?.id)}
                    isSolving={isSolving}
                    showBank={!hideBank}
                    solvedCount={solvedCount}
                    maxMessages={maxMessages}
                    onClick={() => toggleInfo(true)}
                />

                <div className="flex items-center gap-2 shrink-0">
                    {!isSolving && (
                        messageCount < MIN_MESSAGES_BEFORE_SOLVE ? (
                            <InvitePlayer gameId={game.id} players={players} />
                        ) : (
                            <button
                                onClick={handlePropose}
                                disabled={isProposing}
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait rounded text-xs font-bold text-white transition-colors"
                            >
                                {isProposing ? '...' : t('solve')}
                            </button>
                        )
                    )}

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleInfo(true);
                        }}
                        className="p-2 -me-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                        aria-label="Settings"
                    >
                        <MoreVertical className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {isSolving && (
                <SolvingStatsBar
                    teamConsecutiveCorrect={game.team_consecutive_correct || 0}
                    isFeverMode={isFeverMode}
                />
            )}

            {game.solving_proposal_created_at && (
                <SolveProposalBanner
                    players={players}
                    confirmations={game.solve_proposal_confirmations || []}
                    currentUserId={user?.id}
                    secondsLeft={proposalTimeLeft}
                    onConfirm={onConfirmSolving}
                    onDeny={onDenySolving}
                />
            )}

            {showLeaveConfirm && (
                <LeaveGameConfirm
                    onLeavePermanently={() => {
                        onLeave?.();
                        setShowLeaveConfirm(false);
                    }}
                    onGoHome={() => {
                        onBack();
                        setShowLeaveConfirm(false);
                    }}
                    onCancel={() => setShowLeaveConfirm(false)}
                />
            )}

            {isInfoOpen && (
                <div onClick={(e) => e.stopPropagation()}>
                    <InfoScreen
                        game={game}
                        players={players}
                        user={user}
                        onClose={() => toggleInfo(false)}
                        theme={theme}
                        shareText={shareText}
                        date={date}
                        solvedCount={solvedCount}
                        onRestartTutorial={onRestartTutorial}
                        onAutoHintChange={onAutoHintChange}
                    />
                </div>
            )}
        </header>
    );
}
