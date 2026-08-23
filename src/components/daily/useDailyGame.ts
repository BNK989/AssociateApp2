import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { Message } from '@/hooks/useGameLogic';
import { calculateSimilarity } from '@/lib/gameLogic';
import { GAME_CONFIG } from '@/lib/gameConfig';
import {
    buildInitialMessages,
    countRemainingAfterSolve,
    findTargetMessage,
    LOCAL_USER_ID,
} from '@/lib/daily/dailyMessages';
import { applyArrivalHint } from '@/lib/daily/arrivalHints';
import { calculateSolvePoints, MATCH_THRESHOLD, MAX_STRIKES } from '@/lib/daily/dailyScoring';
import { clearDailyGame, loadDailyGame, saveDailyGame } from '@/lib/daily/dailyStorage';
import { startLevelFor, type DailyHintPolicy } from '@/lib/daily/hintPolicy';
import { useDailyHintReveal } from './useDailyHintReveal';
import type { WordOutcome } from '@/lib/daily/dailyResults';

/** How long the "+points" flourish stays on a solved word. */
const SOLVED_FLASH_MS = 1500;

/** Shake duration on a wrong guess. */
const SHAKE_MS = 500;

/** Deliberate pause before resolving a guess, so the answer does not snap in. */
const RESOLVE_DELAY_MS = 300;

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
    onCompleted?: (finalScore: number) => void;
    /** Fires once per word as it leaves the board, however it left. */
    onWordFinished?: (args: {
        index: number;
        outcome: WordOutcome;
        hintLevel: number;
        strikes: number;
        points: number;
        totalScore: number;
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
    const [shakeMessageId, setShakeMessageId] = useState<string | null>(null);
    const [justSolvedData, setJustSolvedData] = useState<{ id: string; points: number } | null>(null);

    const targetMessage = useMemo(() => findTargetMessage(messages), [messages]);

    const fallbackHint = useCallback((word: string) => t('hint_fallback', {
        length: word.length,
        firstLetter: word[0].toUpperCase(),
    }), [t]);

    const freshMessages = useCallback(() => buildInitialMessages({
        words,
        policy,
        hints,
        connectionScores,
        fallbackHint,
        animateStartWord: GAME_CONFIG.DAILY_GAME_ANIMATE_START_MESSAGE,
    }), [words, policy, hints, connectionScores, fallbackHint]);

    // Restore the day's progress, or start a new chain.
    useEffect(() => {
        const restored = loadDailyGame(date, words, {
            settingsRevision,
            onRevisionChange: policy.onRevisionChange,
        });

        if (restored) {
            setMessages(restored.messages);
            setScore(restored.score);
            setConsecutive(restored.consecutive);
            setGameOver(restored.gameOver);
            setRestoredComplete(restored.gameOver);
            return;
        }

        setMessages(freshMessages());
    }, [date, words, freshMessages, settingsRevision, policy.onRevisionChange]);

    // Mirror every change back to storage.
    useEffect(() => {
        if (messages.length === 0) return;
        saveDailyGame(date, words, { messages, score, consecutive, gameOver }, settingsRevision);
    }, [messages, score, consecutive, gameOver, date, words, settingsRevision]);

    /** Clue for a word, preferring the day's authored hint over the generic one. */
    const resolveClue = useCallback(
        (index: number, word: string) => hints?.[index] ?? fallbackHint(word),
        [hints, fallbackHint],
    );

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

    const flashSolved = useCallback((id: string, points: number) => {
        setJustSolvedData({ id, points });
        setTimeout(() => setJustSolvedData(null), SOLVED_FLASH_MS);
    }, []);

    /** Marks a word solved for zero points and ends the game if it was the last. */
    const finishWord = useCallback((message: Message, points: number) => {
        patchTarget(message.id, {
            is_solved: true,
            solved_by: LOCAL_USER_ID,
            winner_points: points,
        });

        if (countRemainingAfterSolve(messages, message.id) === 0) {
            setGameOver(true);
            return true;
        }
        return false;
    }, [messages, patchTarget]);

    const solve = useCallback((guess: string) => {
        if (!targetMessage || gameOver) return;

        const isMatch = calculateSimilarity(guess, targetMessage.content) >= MATCH_THRESHOLD;
        setSending(true);

        setTimeout(() => {
            setSending(false);
            setInput('');

            if (!isMatch) {
                const strikes = (targetMessage.strikes || 0) + 1;
                patchTarget(targetMessage.id, {
                    strikes,
                    is_solved: strikes >= MAX_STRIKES,
                    guesses: [...(targetMessage.guesses || []), guess],
                });

                setConsecutive(0);
                setShakeMessageId(targetMessage.id);
                setTimeout(() => setShakeMessageId(null), SHAKE_MS);

                if (strikes >= MAX_STRIKES) {
                    toast.error(t('toast_word_lost', { word: targetMessage.content }));
                    onWordFinished?.({
                        index: indexOfMessage(targetMessage.id),
                        outcome: 'struck_out',
                        hintLevel: targetMessage.hint_level || 0,
                        strikes,
                        points: 0,
                        totalScore: score,
                        completed: false,
                    });
                }
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

            const completed = finishWord(targetMessage, points);

            onWordFinished?.({
                index: indexOfMessage(targetMessage.id),
                outcome: 'solved',
                hintLevel: targetMessage.hint_level || 0,
                strikes: targetMessage.strikes || 0,
                points,
                totalScore,
                completed,
            });

            if (completed) {
                onCompleted?.(totalScore);
            }
        }, RESOLVE_DELAY_MS);
    }, [
        targetMessage, gameOver, consecutive, score, patchTarget, flashSolved,
        finishWord, onSolved, onCompleted, onWordFinished, indexOfMessage,
        playSuccessSound, t, policy, words.length,
    ]);

    const giveUp = useCallback(() => {
        if (!targetMessage || gameOver) return;

        setConsecutive(0);
        const completed = finishWord(targetMessage, 0);

        onWordFinished?.({
            index: indexOfMessage(targetMessage.id),
            outcome: 'gave_up',
            hintLevel: targetMessage.hint_level || 0,
            strikes: targetMessage.strikes || 0,
            points: 0,
            totalScore: score,
            completed,
        });

        setInput('');
    }, [targetMessage, gameOver, finishWord, onWordFinished, indexOfMessage, score]);

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
