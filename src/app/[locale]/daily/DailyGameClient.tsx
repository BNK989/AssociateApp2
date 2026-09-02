'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { usePostHog, useFeatureFlagPayload } from 'posthog-js/react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthProvider';
import { ChatArea } from '@/components/game/ChatArea';
import { GameHeader } from '@/components/game/GameHeader';
import { GameInput } from '@/components/game/GameInput';
import { GameShell } from '@/components/game/GameShell';
import { DailyEndGamePopover } from '@/components/game/DailyEndGamePopover';
import { WalkthroughProvider } from '@/components/ui/walkthrough';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { createLogger } from '@/lib/logger';
import { buildDailyGameState, buildDailyPlayers, MOCK_USER } from '@/components/daily/dailyPlayers';
import { useAutoHint } from '@/components/daily/useAutoHint';
import { useDailyCompletion } from '@/components/daily/useDailyCompletion';
import { useDailyGame } from '@/components/daily/useDailyGame';
import { useDailyResults, type RecordWordArgs } from '@/components/daily/useDailyResults';
import { useDailyShareText } from '@/components/daily/useDailyShareText';
import { useDailySettings } from '@/components/daily/useDailySettings';
import { useDailyTutorial } from '@/components/daily/useDailyTutorial';
import { useStartWordAnimation } from '@/components/daily/useStartWordAnimation';
import type { DailyHintSettings } from '@/lib/gameSettings/settingsRow';

const log = createLogger('daily/client');

const SUCCESS_SOUND_SRC = '/sounds/notifications/correct-choice.mp3';
const SUCCESS_SOUND_VOLUME = 0.6;

type DailyGameClientProps = {
    dailyWords: string[];
    date: string;
    theme?: string;
    initialHints?: string[] | null;
    initialConnectionScores?: number[] | null;
    /** Game-master hint policy, resolved on the server so there is no flash. */
    hintSettings: DailyHintSettings;
};

export default function DailyGameClient(props: DailyGameClientProps) {
    return (
        <WalkthroughProvider>
            <DailyGameBoard {...props} />
        </WalkthroughProvider>
    );
}

/**
 * The start level assigned by the PostHog experiment, or null when the player
 * is not in one.
 *
 * Since game-master controls landed, this flag is an experiment surface only:
 * the day-to-day value lives in `game_settings` and is edited from the admin
 * panel. Returning null rather than 0 is what keeps the two apart — an
 * unassigned player must fall through to the game master's policy instead of
 * silently overriding it with zero.
 */
function useExperimentStartLevel(): number | null {
    const payload = useFeatureFlagPayload('dailygame-auto-hint-level');
    const posthog = usePostHog();

    const level = typeof payload === 'object' && payload !== null && 'initialHintCount' in payload
        ? (payload as { initialHintCount: number }).initialHintCount
        : null;

    useEffect(() => {
        if (level === null) return;
        log.debug('feature_flag', 'Auto-hint experiment assigned a start level', {
            resolved_level: level,
            variant: String(posthog.getFeatureFlag('dailygame-auto-hint-level')),
        });
    }, [level, posthog]);

    return level;
}

/** Preloads the solve chime so the first correct answer is not silent. */
function useSuccessSound() {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = new Audio(SUCCESS_SOUND_SRC);
        audio.volume = SUCCESS_SOUND_VOLUME;
        audio.preload = 'auto';
        audioRef.current = audio;
    }, []);

    return useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = 0;
        audio.play().catch((e) => log.warn('play_audio', 'Success sound playback failed', undefined, e));
    }, []);
}

function DailyGameBoard({
    dailyWords,
    date,
    theme,
    initialHints,
    initialConnectionScores,
    hintSettings,
}: DailyGameClientProps) {
    const router = useRouter();
    const { user: authUser, session, loading: authLoading } = useAuth();
    const posthog = usePostHog();
    const t = useTranslations('GameRoom.Chat');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [isInfoOpen, setIsInfoOpen] = useState(false);

    const experimentStartLevel = useExperimentStartLevel();
    const playSuccessSound = useSuccessSound();
    const settings = useDailySettings(authUser, isInfoOpen, hintSettings, experimentStartLevel);
    const userType = authUser ? 'registered' : 'guest';

    /**
     * The results hook needs the word currently in play, which only exists once
     * the game hook has run, so the callback reaches it through a ref rather
     * than the two hooks depending on each other.
     */
    const recordWordRef = useRef<((args: RecordWordArgs) => void) | null>(null);

    const game = useDailyGame({
        words: dailyWords,
        date,
        policy: settings.policy,
        settingsRevision: hintSettings.revision,
        hints: initialHints,
        connectionScores: initialConnectionScores,
        playSuccessSound,
        onSolved: ({ word, points, totalScore, consecutive }) => {
            posthog.capture('daily_word_solved', {
                word,
                score_gained: points,
                total_score: totalScore,
                consecutive,
                user_type: userType,
                date,
                settings_revision: hintSettings.revision,
            });
        },
        onCompleted: (finalScore) => {
            posthog.capture('daily_game_completed', {
                final_score: finalScore,
                total_words: dailyWords.length,
                user_type: userType,
                date,
                settings_revision: hintSettings.revision,
            });
        },
        onWordFinished: (args) => recordWordRef.current?.(args),
    });

    const results = useDailyResults({
        playDate: date,
        wordsTotal: dailyWords.length,
        activeWordId: game.targetMessage?.id ?? null,
        accessToken: session?.access_token,
        settingsRevision: hintSettings.revision,
    });

    useEffect(() => {
        recordWordRef.current = results.recordWord;
    }, [results.recordWord]);

    const shareText = useDailyShareText({
        date,
        score: game.score,
        messages: game.messages,
        streak: results.streak,
    });

    const { showSummary } = useDailyCompletion(game.gameOver, game.restoredComplete);
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
    const revealHint = useCallback(() => applyHint(fetchHint), [applyHint, fetchHint]);

    const autoHint = useAutoHint({
        targetMessage: game.targetMessage,
        gameOver: game.gameOver,
        policy: settings.policy,
        onReveal: revealHint,
    });

    const animateStartWord = useStartWordAnimation({
        messages: game.messages,
        startWord: dailyWords[dailyWords.length - 1],
        setInput: game.setInput,
        onSolved: game.solveStartWord,
    });

    // Entrance is tracked once, after auth resolves so user_type is accurate.
    const hasTrackedEntrance = useRef(false);
    useEffect(() => {
        if (authLoading || hasTrackedEntrance.current) return;
        hasTrackedEntrance.current = true;
        posthog.capture('daily_game_entered', {
            user_type: userType,
            date,
            settings_revision: hintSettings.revision,
        });
    }, [authLoading, userType, date, posthog, hintSettings.revision]);

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
                onGetHint={revealHint}
                isEmpty={false}
                isSinglePlayer
                onGiveUp={game.giveUp}
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
                totalWords={dailyWords.length}
                shareText={shareText}
                streak={results.streak}
                onClose={() => router.push('/')}
            />
        </GameShell>
    );
}
