import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { Message } from '@/hooks/useGameLogic';
import { calculateSimilarity } from '@/lib/gameLogic';
import { LOCAL_USER_ID } from '@/lib/daily/dailyMessages';
import { calculateSolvePoints, MATCH_THRESHOLD, MAX_STRIKES } from '@/lib/daily/dailyScoring';
import { startLevelFor, type DailyHintPolicy } from '@/lib/daily/hintPolicy';
import { solveFeedback } from '@/lib/daily/feedbackTiers';
import { streakAfterSolve, streakAfterUnsolved } from '@/lib/daily/streakRules';
import type { WordOutcome } from '@/lib/daily/dailyResults';

/**
 * The two moves a player makes against a word: guess it, or ask to see it.
 *
 * Split out of `useDailyGame` when that file crossed the 350-line cap. The
 * division is the one the rest of `src/components/daily/` already uses — the
 * game hook owns the board's *state*, this owns what a move *does* to it — and
 * it keeps the scoring, streak and reporting decisions of a single move
 * readable in one place instead of halfway down a much longer file.
 */

/** Deliberate pause before resolving a guess, so the answer does not snap in. */
export const RESOLVE_DELAY_MS = 300;

/** Marks a word as taken by the player, for `points`. */
const takenBy = (points: number): Partial<Message> => ({
    is_solved: true,
    solved_by: LOCAL_USER_ID,
    winner_points: points,
});

type WordReport = {
    outcome: WordOutcome;
    points: number;
    totalScore: number;
    remaining: number;
    consecutive: number;
    strikes?: number;
};

type UseDailyMovesArgs = {
    targetMessage?: Message;
    gameOver: boolean;
    words: string[];
    policy: DailyHintPolicy;
    score: number;
    consecutive: number;
    setScore: (score: number) => void;
    setConsecutive: (consecutive: number) => void;
    setInput: (input: string) => void;
    patchTarget: (id: string, updates: Partial<Message>) => void;
    /** Takes a word off the board; returns how many are still in play. */
    finishWord: (message: Message, updates: Partial<Message>) => number;
    reportWord: (message: Message, report: WordReport) => void;
    indexOfMessage: (id: string) => number;
    flashSolved: (id: string, points: number, feedback: ReturnType<typeof solveFeedback>) => void;
    shakeWord: (id: string) => void;
    onCompleted?: (finalScore: number, endedOn: WordOutcome) => void;
    playSolveSound?: (feedback: ReturnType<typeof solveFeedback>) => void;
    playMissSound?: () => void;
};

export function useDailyMoves({
    targetMessage,
    gameOver,
    words,
    policy,
    score,
    consecutive,
    setScore,
    setConsecutive,
    setInput,
    patchTarget,
    finishWord,
    reportWord,
    indexOfMessage,
    flashSolved,
    shakeWord,
    onCompleted,
    playSolveSound,
    playMissSound,
}: UseDailyMovesArgs) {
    const t = useTranslations('GameRoom.Chat');
    const [sending, setSending] = useState(false);

    const solve = useCallback((guess: string) => {
        if (!targetMessage || gameOver) return;

        const similarity = calculateSimilarity(guess, targetMessage.content);
        const isMatch = similarity >= MATCH_THRESHOLD;
        setSending(true);

        setTimeout(() => {
            setSending(false);
            setInput('');

            if (!isMatch) {
                const strikes = (targetMessage.strikes || 0) + 1;
                const struckOut = strikes >= MAX_STRIKES;
                const updates: Partial<Message> = {
                    strikes,
                    is_solved: struckOut,
                    guesses: [...(targetMessage.guesses || []), guess],
                };

                shakeWord(targetMessage.id);
                playMissSound?.();

                if (!struckOut) {
                    patchTarget(targetMessage.id, updates);
                    return;
                }

                const remaining = finishWord(targetMessage, updates);
                const nextConsecutive = streakAfterUnsolved(consecutive);
                setConsecutive(nextConsecutive);

                toast.error(t('toast_word_lost', { word: targetMessage.content }));
                reportWord(targetMessage, {
                    outcome: 'struck_out',
                    points: 0,
                    totalScore: score,
                    remaining,
                    strikes,
                    consecutive: nextConsecutive,
                });

                if (remaining === 0) onCompleted?.(score, 'struck_out');
                return;
            }

            const points = calculateSolvePoints(
                targetMessage.content,
                targetMessage.hint_level,
                consecutive,
                {
                    startLevel: startLevelFor(policy, indexOfMessage(targetMessage.id), words.length),
                    chargeForStartLevel: policy.chargeForStartLevel,
                },
            );
            const totalScore = score + points;
            const nextConsecutive = streakAfterSolve(consecutive);

            setScore(totalScore);
            setConsecutive(nextConsecutive);

            // Graded once, here, and handed to both halves of the feedback. The
            // chime used to fire before the points were known, so it could not
            // reflect them; now the sound and the burst are the same decision.
            const feedback = solveFeedback({
                word: targetMessage.content,
                points,
                consecutive: nextConsecutive,
            });

            playSolveSound?.(feedback);
            flashSolved(targetMessage.id, points, feedback);

            const remaining = finishWord(targetMessage, takenBy(points));

            reportWord(targetMessage, {
                outcome: 'solved', points, totalScore, remaining, consecutive: nextConsecutive,
            });

            if (remaining === 0) onCompleted?.(totalScore, 'solved');
        }, RESOLVE_DELAY_MS);
    }, [
        targetMessage, gameOver, consecutive, score, patchTarget, flashSolved,
        shakeWord, finishWord, reportWord, onCompleted, setScore, setConsecutive,
        setInput, indexOfMessage, playSolveSound, playMissSound, t, policy, words.length,
    ]);

    /**
     * Shows the player the word and moves on.
     *
     * This was `giveUp`, and it zeroed the streak on top of the points already
     * forfeited — the same lost word charged twice. It costs one streak step
     * now, exactly as a struck-out word does: the two are the same position to
     * be in, and grading one harder only teaches players the other route.
     */
    const revealWord = useCallback(() => {
        if (!targetMessage || gameOver) return;

        const nextConsecutive = streakAfterUnsolved(consecutive);
        setConsecutive(nextConsecutive);

        const remaining = finishWord(targetMessage, takenBy(0));

        reportWord(targetMessage, {
            outcome: 'gave_up',
            points: 0,
            totalScore: score,
            remaining,
            consecutive: nextConsecutive,
        });

        if (remaining === 0) onCompleted?.(score, 'gave_up');

        setInput('');
    }, [
        targetMessage, gameOver, finishWord, reportWord, onCompleted,
        score, consecutive, setConsecutive, setInput,
    ]);

    return { solve, revealWord, sending };
}
