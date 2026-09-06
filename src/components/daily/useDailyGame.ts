import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { Message } from '@/hooks/useGameLogic';
import { calculateSimilarity } from '@/lib/gameLogic';
import {
    countRemainingAfterSolve,
    findTargetMessage,
    LOCAL_USER_ID,
} from '@/lib/daily/dailyMessages';
import { applyArrivalHint } from '@/lib/daily/arrivalHints';
import { calculateSolvePoints, MATCH_THRESHOLD, MAX_STRIKES } from '@/lib/daily/dailyScoring';
import { clearDailyGame, loadDailyGame, saveDailyGame } from '@/lib/daily/dailyStorage';
import { startLevelFor, type DailyHintPolicy } from '@/lib/daily/hintPolicy';
import { useChainClues } from './useChainClues';
import { useDailyHintReveal } from './useDailyHintReveal';
import { useMoveFeedback } from './useMoveFeedback';
import type { WordOutcome } from '@/lib/daily/dailyResults';

/** Deliberate pause before resolving a guess, so the answer does not snap in. */
const RESOLVE_DELAY_MS = 300;

/** Marks a word as taken by the player, for `points`. */
const takenBy = (points: number): Partial<Message> => ({
    is_solved: true,
    solved_by: LOCAL_USER_ID,
    winner_points: points,
});

type UseDailyGameArgs = {
    words: string[];
    date: string;
    /** Game-master hint policy in force for this play. */
    policy: DailyHintPolicy;
    /** Revision of the policy, recorded with the save and with every result. */
    settingsRevision: number;
    hints?: string[] | null;
    connectionScores?: number[] | null;
    onSolved?: (args: { word: string; points: number; totalScore: number; consecutive: number }) => void;
    /** Fires once when the last word leaves the board, however it left. */
    onCompleted?: (finalScore: number, endedOn: WordOutcome) => void;
    /** Fires once per word as it leaves the board, however it left. */
    onWordFinished?: (args: {
        index: number;
        outcome: WordOutcome;
        hintLevel: number;
        strikes: number;
        points: number;
        totalScore: number;
        /** Words still in play after this one left. */
        remaining: number;
        /** Solves in a row, counted after this word. */
        consecutive: number;
        completed: boolean;
    }) => void;
    playSuccessSound?: () => void;
};

/**
 * The daily game's state machine: the word chain, the score, and the moves a
 * player can make against it.
 *
 * Everything lives client-side and is mirrored to localStorage after each
 * change — the daily game writes no rows, unlike classic mode.
 */
export function useDailyGame({
    words,
    date,
    policy,
    settingsRevision,
    hints,
    connectionScores,
    onSolved,
    onCompleted,
    onWordFinished,
    playSuccessSound,
}: UseDailyGameArgs) {
    const t = useTranslations('GameRoom.Chat');

    const [messages, setMessages] = useState<Message[]>([]);
    const [score, setScore] = useState(0);
    const [consecutive, setConsecutive] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [restoredComplete, setRestoredComplete] = useState(false);

    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const { shakeMessageId, justSolvedData, flashSolved, shakeWord } = useMoveFeedback();

    const targetMessage = useMemo(() => findTargetMessage(messages), [messages]);

    const { fallbackHint, freshMessages, resolveClue } = useChainClues({
        words, policy, hints, connectionScores,
    });

    // Restore the day's progress, or start a new chain.
    useEffect(() => {
        const restored = loadDailyGame(date, words, {
            settingsRevision,
            onRevisionChange: policy.onRevisionChange,
        });

        if (restored) {
            // The arrival pass runs here too, not only on a move. A board saved
            // under an older policy comes back with the word the player is
            // sitting on below the level the current policy entitles it to —
            // and scoring already reads the current policy, so those tiers are
            // being given away free while the board still hides them.
            setMessages(applyArrivalHint(restored.messages, policy, resolveClue));
            setScore(restored.score);
            setConsecutive(restored.consecutive);
            setGameOver(restored.gameOver);
            setRestoredComplete(restored.gameOver);
            return;
        }

        setMessages(freshMessages());
    }, [date, words, freshMessages, settingsRevision, policy, resolveClue]);

    // Mirror every change back to storage.
    useEffect(() => {
        if (messages.length === 0) return;
        saveDailyGame(date, words, { messages, score, consecutive, gameOver }, settingsRevision);
    }, [messages, score, consecutive, gameOver, date, words, settingsRevision]);

    /**
     * Applies a change to one word, then brings whichever word is now the
     * target up to the level the policy entitles it to.
     *
     * Every mutation goes through here, so the arrival pass runs wherever the
     * target can have moved — a solve, a give-up, or a third strike — without
     * each of those paths having to remember to do it.
     */
    const patchTarget = useCallback((id: string, updates: Partial<Message>) => {
        setMessages((prev) => applyArrivalHint(
            prev.map((m) => (m.id === id ? { ...m, ...updates } : m)),
            policy,
            resolveClue,
        ));
    }, [policy, resolveClue]);

    /** Position of a word in the chain, which is how results are indexed. */
    const indexOfMessage = useCallback(
        (id: string) => messages.findIndex((m) => m.id === id),
        [messages],
    );

    /**
     * Takes a word off the board and reports whether that finished the chain.
     *
     * Every exit routes through here -- solve, give-up and third strike alike.
     * The strike path used to patch the board directly and skip the
     * remaining-words check, so a chain whose *last* word was struck out never
     * set `gameOver`: no summary and no share sheet, on a board with nothing
     * left to guess. It persisted that way, so a reload restored the dead end.
     */
    const finishWord = useCallback((message: Message, updates: Partial<Message>) => {
        patchTarget(message.id, updates);

        const remaining = countRemainingAfterSolve(messages, message.id);
        if (remaining === 0) setGameOver(true);

        return remaining;
    }, [messages, patchTarget]);

    /**
     * Announces a word leaving the board. `strikes` defaults to what the word
     * carried, since only the strike path changes it on the way out.
     */
    const reportWord = useCallback((message: Message, report: {
        outcome: WordOutcome;
        points: number;
        totalScore: number;
        remaining: number;
        consecutive: number;
        strikes?: number;
    }) => {
        onWordFinished?.({
            index: indexOfMessage(message.id),
            outcome: report.outcome,
            hintLevel: message.hint_level || 0,
            strikes: report.strikes ?? message.strikes ?? 0,
            points: report.points,
            totalScore: report.totalScore,
            remaining: report.remaining,
            consecutive: report.consecutive,
            completed: report.remaining === 0,
        });
    }, [onWordFinished, indexOfMessage]);

    const solve = useCallback((guess: string) => {
        if (!targetMessage || gameOver) return;

        const isMatch = calculateSimilarity(guess, targetMessage.content) >= MATCH_THRESHOLD;
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

                setConsecutive(0);
                shakeWord(targetMessage.id);

                if (!struckOut) {
                    patchTarget(targetMessage.id, updates);
                    return;
                }

                const remaining = finishWord(targetMessage, updates);

                toast.error(t('toast_word_lost', { word: targetMessage.content }));
                reportWord(targetMessage, {
                    outcome: 'struck_out', points: 0, totalScore: score, remaining, strikes, consecutive: 0,
                });

                if (remaining === 0) onCompleted?.(score, 'struck_out');
                return;
            }

            playSuccessSound?.();

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

            setScore(totalScore);
            setConsecutive((prev) => prev + 1);
            flashSolved(targetMessage.id, points);

            onSolved?.({
                word: targetMessage.content,
                points,
                totalScore,
                consecutive: consecutive + 1,
            });

            const remaining = finishWord(targetMessage, takenBy(points));

            reportWord(targetMessage, {
                outcome: 'solved', points, totalScore, remaining, consecutive: consecutive + 1,
            });

            if (remaining === 0) onCompleted?.(totalScore, 'solved');
        }, RESOLVE_DELAY_MS);
    }, [
        targetMessage, gameOver, consecutive, score, patchTarget, flashSolved,
        shakeWord, finishWord, reportWord, onSolved, onCompleted,
        indexOfMessage, playSuccessSound, t, policy, words.length,
    ]);

    const giveUp = useCallback(() => {
        if (!targetMessage || gameOver) return;

        setConsecutive(0);
        const remaining = finishWord(targetMessage, takenBy(0));

        reportWord(targetMessage, {
            outcome: 'gave_up', points: 0, totalScore: score, remaining, consecutive: 0,
        });

        if (remaining === 0) onCompleted?.(score, 'gave_up');

        setInput('');
    }, [targetMessage, gameOver, finishWord, reportWord, onCompleted, score]);

    const revealHint = useDailyHintReveal({
        targetMessage,
        gameOver,
        words,
        hints,
        policy,
        date,
        fallbackHint,
        patchTarget,
    });

    const reset = useCallback(() => {
        clearDailyGame(date);
        setMessages(freshMessages());
        setScore(0);
        setConsecutive(0);
        setGameOver(false);
        setRestoredComplete(false);
        setInput('');
        toast.success(t('toast_reset_success'));
    }, [date, freshMessages, t]);

    /** Admin shortcut: jump straight to the end-of-game state. */
    const forceGameOver = useCallback(() => setGameOver(true), []);

    // Solves the free starting word, used by the entry typing animation.
    const solveStartWord = useCallback((id: string) => {
        patchTarget(id, { is_solved: true, solved_by: LOCAL_USER_ID, winner_points: 0 });
        flashSolved(id, 0);
    }, [patchTarget, flashSolved]);

    const solvedCount = useMemo(
        () => messages.filter((m) => m.is_solved).length,
        [messages],
    );

    return {
        messages,
        targetMessage,
        score,
        consecutive,
        gameOver,
        restoredComplete,
        solvedCount,
        input,
        setInput,
        sending,
        shakeMessageId,
        justSolvedData,
        solve,
        giveUp,
        revealHint,
        reset,
        forceGameOver,
        solveStartWord,
    };
}
