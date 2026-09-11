import { useCallback, useMemo, useState } from 'react';
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
import { calculateSolvePoints, MATCH_THRESHOLD, MAX_HINT_LEVEL, MAX_STRIKES } from '@/lib/daily/dailyScoring';
import { clearDailyGame } from '@/lib/daily/dailyStorage';
import { startLevelFor, type DailyHintPolicy } from '@/lib/daily/hintPolicy';
import { solveFeedback } from '@/lib/daily/feedbackTiers';
import { streakAfterSolve, streakAfterUnsolved } from '@/lib/daily/streakRules';
import { useChainClues } from './useChainClues';
import { useDailyPersistence } from './useDailyPersistence';
import { useDailyHintReveal } from './useDailyHintReveal';
import { useDailyMoves, RESOLVE_DELAY_MS } from './useDailyMoves';
import { useMoveFeedback } from './useMoveFeedback';
import type { WordOutcome } from '@/lib/daily/dailyResults';
import type { HintSource } from '@/lib/daily/dailyAnalytics';

type UseDailyGameArgs = {
    words: string[];
    date: string;
    /** Game-master hint policy in force for this play. */
    policy: DailyHintPolicy;
    /** Revision of the policy, recorded with the save and with every result. */
    settingsRevision: number;
    hints?: string[] | null;
    connectionScores?: number[] | null;
    /** Fires once when the last word leaves the board, however it left. */
    onCompleted?: (finalScore: number, endedOn: WordOutcome) => void;
    /** Fires once per word as it leaves the board, however it left. */
    onWordFinished?: (args: {
        index: number;
        /** The word itself. Only ever reported once it is off the board. */
        word: string;
        outcome: WordOutcome;
        hintLevel: number;
        strikes: number;
        points: number;
        totalScore: number;
        /** Words still in play after this one left. */
        remaining: number;
        /** Solves in a row, counted after this word. */
        consecutive: number;
        /** Whether the hint ladder was spent by the time the word left. */
        hintsExhausted: boolean;
        completed: boolean;
    }) => void;
    /** Reward chime and haptics for a correct guess, graded by how it was earned. */
    playSolveSound?: (feedback: ReturnType<typeof solveFeedback>) => void;
    /** The wrong-guess tone. Fires on every miss, struck out or not. */
    playMissSound?: () => void;
    /** Fires whenever a hint lands, however it was triggered. */
    onHintRevealed?: (args: { message: Message; toLevel: number; source: HintSource }) => void;
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
    onCompleted,
    onWordFinished,
    playSolveSound,
    playMissSound,
    onHintRevealed,
}: UseDailyGameArgs) {
    const t = useTranslations('GameRoom.Chat');

    const [messages, setMessages] = useState<Message[]>([]);
    const [score, setScore] = useState(0);
    const [consecutive, setConsecutive] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [restoredComplete, setRestoredComplete] = useState(false);

    const [input, setInput] = useState('');
    const { shakeMessageId, justSolvedData, flashSolved, shakeWord } = useMoveFeedback();

    const targetMessage = useMemo(() => findTargetMessage(messages), [messages]);

    const { fallbackHint, freshMessages, resolveClue } = useChainClues({
        words, policy, hints, connectionScores,
    });

    useDailyPersistence({
        date,
        words,
        policy,
        settingsRevision,
        snapshot: { messages, score, consecutive, gameOver },
        onRestore: (restored) => {
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
        },
        onFresh: () => setMessages(freshMessages()),
    });

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
            word: message.content,
            outcome: report.outcome,
            hintLevel: message.hint_level || 0,
            hintsExhausted: (message.hint_level || 0) >= MAX_HINT_LEVEL,
            strikes: report.strikes ?? message.strikes ?? 0,
            points: report.points,
            totalScore: report.totalScore,
            remaining: report.remaining,
            consecutive: report.consecutive,
            completed: report.remaining === 0,
        });
    }, [onWordFinished, indexOfMessage]);

    const { solve, revealWord, sending } = useDailyMoves({
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
    });

    const revealHint = useDailyHintReveal({
        targetMessage,
        gameOver,
        words,
        hints,
        policy,
        date,
        fallbackHint,
        patchTarget,
        onRevealed: onHintRevealed,
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
        revealWord,
        revealHint,
        reset,
        forceGameOver,
        solveStartWord,
    };
}
