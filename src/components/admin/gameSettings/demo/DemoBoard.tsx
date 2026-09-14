'use client';

import { useCallback, useMemo, useState } from 'react';
import { GameInput } from '@/components/game/GameInput';
import { StuckOffer } from '@/components/daily/StuckOffer';
import { useDailySettle } from '@/components/daily/useDailySettle';
import { useMoveFeedback } from '@/components/daily/useMoveFeedback';
import { useRewardFeedback } from '@/hooks/useRewardFeedback';
import { MOCK_USER, buildDailyGameState, buildDailyPlayers } from '@/components/daily/dailyPlayers';
import { solveFeedback } from '@/lib/daily/feedbackTiers';
import { MAX_HINT_LEVEL } from '@/lib/daily/dailyScoring';
import { DemoControls, SKIP_STEP_MS } from './DemoControls';
import { DemoWordRow } from './DemoWordRow';
import { useDemoGame, type DemoSolve } from './useDemoGame';
import { useDemoOffer } from './useDemoOffer';
import type { DemoPolicies } from './demoPolicies';

/**
 * The demo chain, played against the drafts currently in the editor.
 *
 * It is the board rather than a sketch of it: the shipped composer with its
 * letter pool, the shipped stuck offer above it, the shipped settle drip
 * underneath and the shipped reward burst on a solve. All four drafts reach it,
 * so a game master editing the fork sees the fork, and one editing the drip
 * watches letters walk into place at the pace they just set.
 *
 * The panel remounts it under a key derived from those drafts, so every edit
 * starts a clean run rather than leaving a half-played board straddling two
 * configurations.
 */
export function DemoBoard({ policies }: { policies: DemoPolicies }) {
    const { shakeMessageId, justSolvedData, flashSolved, shakeWord } = useMoveFeedback();
    const { playSolve, playMiss } = useRewardFeedback(policies.feedback);

    // Declared before the game, because the game calls them from inside its own
    // submit. That keeps the burst and the chime on the move that earned them
    // rather than an effect and a render later, grading the word before.
    const onSolved = useCallback((solve: DemoSolve) => {
        const feedback = solveFeedback({
            word: solve.word,
            points: solve.points,
            consecutive: solve.consecutive,
            hintLevel: solve.hintLevel,
            settled: solve.settled,
        });
        flashSolved(solve.id, solve.points, feedback);
        playSolve(feedback);
    }, [flashSolved, playSolve]);

    const onMissed = useCallback((id: string) => {
        shakeWord(id);
        playMiss();
    }, [shakeWord, playMiss]);

    const demo = useDemoGame(policies, { onSolved, onMissed });
    const target = demo.targetMessage;
    const atTopOfLadder = (target?.hint_level || 0) >= MAX_HINT_LEVEL;

    const settle = useDailySettle({
        targetMessage: target,
        policy: policies.settle,
        gameOver: demo.gameOver,
        patchTarget: demo.patchTarget,
        indexOfMessage: demo.indexOf,
    });

    /**
     * Dwell handed to the stuck ladder by the skip control, tagged with the
     * word it was granted on so it falls away by itself when the chain moves
     * on. Tagged rather than reset, because a reset would have to live in an
     * effect and would land a render after the word it was meant to clear.
     */
    const [credit, setCredit] = useState<{ wordId: string; ms: number } | null>(null);
    const creditMs = credit && credit.wordId === target?.id ? credit.ms : 0;

    const skipAhead = useCallback(() => {
        if (!target) return;
        setCredit((prev) => ({
            wordId: target.id,
            ms: (prev?.wordId === target.id ? prev.ms : 0) + SKIP_STEP_MS,
        }));
    }, [target]);

    const stuck = useDemoOffer({
        messages: demo.messages,
        targetMessage: target,
        canSettle: settle.available,
        settleLettersLeft: settle.lettersLeft,
        consecutive: demo.consecutive,
        gameOver: demo.gameOver,
        settlePolicy: policies.settle,
        creditMs,
        revealHint: demo.revealHint,
        revealWord: demo.giveUp,
        startSettle: settle.accept,
    });

    const gameState = useMemo(
        () => buildDailyGameState(demo.messages.length, demo.consecutive, demo.gameOver),
        [demo.messages.length, demo.consecutive, demo.gameOver],
    );
    const players = useMemo(
        () => buildDailyPlayers(demo.score, demo.consecutive),
        [demo.score, demo.consecutive],
    );

    return (
        <div className="space-y-4">
            <ol className="space-y-2">
                {demo.messages.map((message) => (
                    <DemoWordRow
                        key={message.id}
                        message={message}
                        isTarget={message.id === target?.id}
                        isWrong={message.id === shakeMessageId && !message.is_solved}
                        justSolved={justSolvedData}
                        feedbackPolicy={policies.feedback}
                    />
                ))}
            </ol>

            {/* The offer anchors to this wrapper rather than to the column, the
                way the game's own does: as a flow sibling it would push the
                board up mid-word, which reads as the page breaking. */}
            <div className="relative shrink-0">
                <StuckOffer
                    offer={stuck.offer}
                    prices={stuck.prices}
                    onAct={stuck.onAct}
                    onDismiss={stuck.onDismiss}
                />

                <GameInput
                    game={gameState}
                    user={MOCK_USER}
                    players={players}
                    input={demo.guess}
                    setInput={demo.setGuess}
                    sending={false}
                    solvingTimeLeft={null}
                    targetMessage={target}
                    onSendMessage={(e) => {
                        e.preventDefault();
                        demo.submit();
                    }}
                    onGetHint={demo.revealHint}
                    isEmpty={false}
                    isSinglePlayer
                    onReveal={demo.giveUp}
                    // One straight chain, so there is no far side to enter from.
                    canOpenOtherEnd={false}
                    caretSkipsGreens={policies.letterPool.caretSkipsGreens}
                    settledIndices={settle.settledIndices}
                    settle={{
                        available: settle.available,
                        running: settle.running,
                        lettersLeft: settle.lettersLeft,
                        secondsLeft: settle.secondsLeft,
                        progress: settle.progress,
                        pendingIndex: settle.pendingIndex,
                        onSettleNow: settle.settleNow,
                        onSettleAt: settle.settleAt,
                        onLanded: settle.onLanded,
                        clueCost: policies.settle.clueCost,
                    }}
                    autoHintProgress={demo.countdown.progress}
                    autoHintSecondsLeft={demo.countdown.secondsLeft}
                    isAutoHintActive={demo.countdown.isActive}
                    isHintPaused={demo.countdown.isPaused}
                    onToggleHintPause={demo.countdown.togglePause}
                />
            </div>

            <DemoControls
                score={demo.score}
                gameOver={demo.gameOver}
                hasTarget={Boolean(target)}
                atTopOfLadder={atTopOfLadder}
                countdown={demo.countdown}
                creditMs={creditMs}
                onFillAnswer={() => target && demo.setGuess(target.content)}
                onHint={demo.revealHint}
                onGiveUp={demo.giveUp}
                onSkipAhead={skipAhead}
            />
        </div>
    );
}
