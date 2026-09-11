'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthProvider';
import { ChatArea } from '@/components/game/ChatArea';
import { GameHeader } from '@/components/game/GameHeader';
import { GameInput } from '@/components/game/GameInput';
import { GameShell } from '@/components/game/GameShell';
import { DailyEndGamePopover } from '@/components/game/DailyEndGamePopover';
import { WalkthroughProvider } from '@/components/ui/walkthrough';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { buildDailyGameState, buildDailyPlayers, MOCK_USER } from '@/components/daily/dailyPlayers';
import { useAutoHint } from '@/components/daily/useAutoHint';
import { useDailyCompletion } from '@/components/daily/useDailyCompletion';
import { useDailyGame } from '@/components/daily/useDailyGame';
import { useDailyOutcome } from '@/components/daily/useDailyOutcome';
import { useDailyResults } from '@/components/daily/useDailyResults';
import { useDailyShareText } from '@/components/daily/useDailyShareText';
import { useDailySettings } from '@/components/daily/useDailySettings';
import { useDailyInstrumentation } from '@/components/daily/useDailyInstrumentation';
import { useDailyTracking } from '@/components/daily/useDailyTracking';
import { useDailyTutorial } from '@/components/daily/useDailyTutorial';
import { useExperimentStartLevel } from '@/components/daily/useExperimentStartLevel';
import { useMissCue } from '@/components/daily/useMissCue';
import { useProgressCue } from '@/components/daily/useProgressCue';
import { useStartWordAnimation } from '@/components/daily/useStartWordAnimation';
import { useRewardFeedback } from '@/hooks/useRewardFeedback';
import type { DailyFeedbackSettings, DailyHintSettings } from '@/lib/gameSettings/settingsRow';

type DailyGameClientProps = {
    dailyWords: string[];
    date: string;
    theme?: string;
    initialHints?: string[] | null;
    initialConnectionScores?: number[] | null;
    /** Game-master hint policy, resolved on the server so there is no flash. */
    hintSettings: DailyHintSettings;
    /** Game-master reward-feedback policy, resolved on the server for the same reason. */
    feedbackSettings: DailyFeedbackSettings;
};

export default function DailyGameClient(props: DailyGameClientProps) {
    return (
        <WalkthroughProvider>
            <DailyGameBoard {...props} />
        </WalkthroughProvider>
    );
}

function DailyGameBoard({
    dailyWords,
    date,
    theme,
    initialHints,
    initialConnectionScores,
    hintSettings,
    feedbackSettings,
}: DailyGameClientProps) {
    const router = useRouter();
    const { user: authUser, session, loading: authLoading } = useAuth();
    const t = useTranslations('GameRoom.Chat');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [isInfoOpen, setIsInfoOpen] = useState(false);

    const experimentStartLevel = useExperimentStartLevel();
    const settings = useDailySettings(
        authUser, isInfoOpen, hintSettings, experimentStartLevel, feedbackSettings,
    );
    const { playSolve, playMiss, preview } = useRewardFeedback(settings.feedback);
    const userType = authUser ? 'registered' : 'guest';

    const showProgressCue = useProgressCue();
    const showMissCue = useMissCue();

    // The free starting word is not one the player guesses, so it is not part
    // of the run they are being encouraged through -- same reasoning as the
    // share grid, which drops it too.
    const guessableWords = dailyWords.length - 1;

    const tracking = useDailyTracking({
        playDate: date,
        userType,
        settingsRevision: hintSettings.revision,
        wordsTotal: dailyWords.length,
        authLoading,
    });

    const { callbacks, attachResults, setOutcomeTier } = useDailyInstrumentation({
        tracking,
        guessableWords,
        showProgressCue,
        showMissCue,
    });

    const game = useDailyGame({
        words: dailyWords,
        date,
        policy: settings.policy,
        settingsRevision: hintSettings.revision,
        hints: initialHints,
        connectionScores: initialConnectionScores,
        playSolveSound: playSolve,
        playMissSound: playMiss,
        ...callbacks,
    });

    const results = useDailyResults({
        playDate: date,
        wordsTotal: dailyWords.length,
        activeWordId: game.targetMessage?.id ?? null,
        accessToken: session?.access_token,
        settingsRevision: hintSettings.revision,
    });

    useEffect(() => {
        attachResults(results.recordWord, results.readElapsed);
    }, [attachResults, results.recordWord, results.readElapsed]);

    const shareText = useDailyShareText({
        date,
        score: game.score,
        messages: game.messages,
        streak: results.streak,
    });

    const { squares, outcome } = useDailyOutcome(game.messages);

    useEffect(() => {
        setOutcomeTier(outcome.tier);
    }, [setOutcomeTier, outcome.tier]);
    const { showSummary } = useDailyCompletion(game.gameOver, game.restoredComplete, outcome.celebrate);
    const tutorial = useDailyTutorial({ authUser, authLoading, words: dailyWords, date });

    /**
     * Only used when the day's hints were not preloaded; the endpoint is rate
     * limited, so the authored hints are always preferred.
     */
    const accessToken = session?.access_token;

    const fetchHint = useCallback(async (targetIndex: number): Promise<string | null> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

        const res = await fetch('/api/daily/hint', {
            method: 'POST',
            headers,
            body: JSON.stringify({ date, targetIndex }),
        });

        if (res.ok) {
            const data = await res.json();
            return data.hint ?? null;
        }

        const err = await res.json();
        if (err.error === 'Limit reached for this game' || err.error === 'Daily IP limit reached') {
            toast.error(t('toast_daily_limit'));
        }
        return null;
    }, [date, accessToken, t]);

    const applyHint = game.revealHint;
    const askForHint = useCallback(() => applyHint(fetchHint, 'manual'), [applyHint, fetchHint]);
    const autoRevealHint = useCallback(() => applyHint(fetchHint, 'auto'), [applyHint, fetchHint]);

    const autoHint = useAutoHint({
        targetMessage: game.targetMessage,
        gameOver: game.gameOver,
        policy: settings.policy,
        onReveal: autoRevealHint,
    });

    const animateStartWord = useStartWordAnimation({
        messages: game.messages,
        startWord: dailyWords[dailyWords.length - 1],
        setInput: game.setInput,
        onSolved: game.solveStartWord,
    });

    // Keep the word being guessed centred as the chain advances.
    useEffect(() => {
        if (!game.targetMessage) return;
        const id = game.targetMessage.id;

        const timer = setTimeout(() => {
            document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);

        return () => clearTimeout(timer);
    }, [game.targetMessage]);

    const gameState = useMemo(
        () => buildDailyGameState(dailyWords.length, game.consecutive, game.gameOver),
        [dailyWords.length, game.consecutive, game.gameOver],
    );

    const players = useMemo(
        () => buildDailyPlayers(game.score, game.consecutive),
        [game.score, game.consecutive],
    );

    return (
        <GameShell>
            <GameHeader
                game={gameState}
                user={MOCK_USER}
                players={players}
                proposalTimeLeft={null}
                targetMessage={game.targetMessage}
                messageCount={game.messages.length}
                maxMessages={dailyWords.length}
                onBack={() => router.push('/')}
                onProposeSolving={() => { }}
                onConfirmSolving={() => { }}
                onDenySolving={() => { }}
                onLeave={() => router.push('/')}
                skipExitConfirm
                theme={theme}
                hideAvatars
                hideBank
                date={date}
                solvedCount={game.solvedCount}
                onRestartTutorial={tutorial.restart}
                externalShowInfo={isInfoOpen}
                onInfoToggle={setIsInfoOpen}
                onAutoHintChange={settings.setAutoHint}
                onAudioChange={settings.setAudio}
                onPreviewSound={preview}
                hintPolicy={settings.policy}
                shareText={shareText}
                onWelcomeComplete={
                    GAME_CONFIG.DAILY_GAME_ANIMATE_START_MESSAGE ? animateStartWord : undefined
                }
            />

            <ChatArea
                messages={game.messages}
                user={MOCK_USER}
                game={gameState}
                messagesEndRef={messagesEndRef}
                targetMessage={game.targetMessage}
                shakeMessageId={game.shakeMessageId}
                justSolvedData={game.justSolvedData}
                feedbackPolicy={settings.feedback}
                players={players}
                onTestEndSequence={game.forceGameOver}
                onResetGame={game.reset}
            />

            <GameInput
                game={gameState}
                user={MOCK_USER}
                players={players}
                input={game.input}
                setInput={game.setInput}
                sending={game.sending}
                solvingTimeLeft={null}
                targetMessage={game.targetMessage}
                onSendMessage={(e) => {
                    e.preventDefault();
                    if (!game.input.trim() || game.sending) return;
                    game.solve(game.input.trim());
                }}
                onGetHint={askForHint}
                isEmpty={false}
                isSinglePlayer
                onReveal={game.revealWord}
                autoHintProgress={autoHint.progress}
                autoHintSecondsLeft={autoHint.secondsLeft}
                isAutoHintActive={autoHint.isActive}
                isHintPaused={autoHint.isPaused}
                onToggleHintPause={autoHint.togglePause}
                onOpenSettings={() => setIsInfoOpen(true)}
            />

            <DailyEndGamePopover
                open={showSummary}
                score={game.score}
                outcome={outcome}
                squares={squares}
                shareText={shareText}
                streak={results.streak}
                onClose={() => router.push('/')}
            />
        </GameShell>
    );
}
