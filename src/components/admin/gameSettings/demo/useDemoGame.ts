'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Message } from '@/hooks/useGameLogic';
import { checkAnswer } from '@/lib/letterPool/answerCheck';
import { applyArrivalHint } from '@/lib/daily/arrivalHints';
import {
    buildInitialMessages,
    countRemainingAfterSolve,
    findTargetMessage,
    LOCAL_USER_ID,
} from '@/lib/daily/dailyMessages';
import {
    calculateSolvePoints,
    getNextHintLevel,
    MAX_HINT_LEVEL,
    MAX_STRIKES,
} from '@/lib/daily/dailyScoring';
import { startLevelFor } from '@/lib/daily/hintPolicy';
import { hintLevelUpdates } from '@/lib/daily/hintVisuals';
import { streakAfterSolve } from '@/lib/daily/streakRules';
import { useAutoHint } from '@/components/daily/useAutoHint';
import { DEMO_CLUES, DEMO_WORDS, demoClue } from './demoChain';
import type { DemoPolicies } from './demoPolicies';

const WORDS = [...DEMO_WORDS];
const CLUES = [...DEMO_CLUES];

/**
 * What a solve is worth telling the board about.
 *
 * The grading itself belongs to `solveFeedback`, which lives with the rest of
 * the reward rules; what this hook owes its caller is the handful of numbers
 * that grading needs, at the moment the solve happened. Read back off state
 * afterwards they would be a render late, and the burst would grade the word
 * after the one that earned it.
 */
export type DemoSolve = {
    /** The message the burst and the flash belong on. */
    id: string;
    word: string;
    points: number;
    /** Solves in a row after this one, which is what the streak step reads. */
    consecutive: number;
    hintLevel: number;
    settled: number;
};

type DemoHandlers = {
    onSolved?: (solve: DemoSolve) => void;
    /** The message that was guessed at, so the board can shake that row. */
    onMissed?: (id: string) => void;
};

/**
 * A playable daily game for the game-settings panel.
 *
 * Deliberately not `useDailyGame`: that one persists to localStorage, records
 * results, fires analytics and toasts, none of which a preview may do. What it
 * *is* is the same rules — the board build, the arrival pass, the ladder, the
 * scheduler and the scoring all come from the modules the real game runs, so
 * the demo cannot tell the game master something the game will not.
 *
 * There is no restart here on purpose. The panel remounts this hook whenever
 * the draft policies change, which resets the board and the countdown together;
 * a reset path inside the hook would be a second way to do that, able to drift.
 */
export function useDemoGame(policies: DemoPolicies, handlers: DemoHandlers = {}) {
    const policy = policies.hint;
    const { onSolved, onMissed } = handlers;

    const [messages, setMessages] = useState<Message[]>(
        () => buildInitialMessages({ words: WORDS, policy, hints: CLUES }),
    );
    const [score, setScore] = useState(0);
    const [consecutive, setConsecutive] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [guess, setGuess] = useState('');
    const [wrongId, setWrongId] = useState<string | null>(null);

    const targetMessage = useMemo(() => findTargetMessage(messages), [messages]);

    const patchTarget = useCallback((id: string, updates: Partial<Message>) => {
        setMessages((prev) => applyArrivalHint(
            prev.map((m) => (m.id === id ? { ...m, ...updates } : m)),
            policy,
            (index) => demoClue(index),
        ));
    }, [policy]);

    const indexOf = useCallback(
        (id: string) => messages.findIndex((m) => m.id === id),
        [messages],
    );

    const finish = useCallback((message: Message, points: number) => {
        patchTarget(message.id, {
            is_solved: true,
            solved_by: LOCAL_USER_ID,
            winner_points: points,
        });

        if (countRemainingAfterSolve(messages, message.id) === 0) setGameOver(true);
    }, [messages, patchTarget]);

    const submit = useCallback(() => {
        const word = guess.trim();
        if (!targetMessage || gameOver || word.length === 0) return;

        setGuess('');

        // The demo plays by the rules of the real game, including its matching.
        const isMatch = checkAnswer(word, targetMessage.content, {
            hintLevel: targetMessage.hint_level || 0, isSinglePlayer: true,
        });

        if (!isMatch) {
            const strikes = (targetMessage.strikes || 0) + 1;
            const struckOut = strikes >= MAX_STRIKES;

            setConsecutive(0);
            setWrongId(targetMessage.id);
            patchTarget(targetMessage.id, {
                strikes,
                is_solved: struckOut,
                guesses: [...(targetMessage.guesses || []), word],
            });
            onMissed?.(targetMessage.id);

            if (struckOut && countRemainingAfterSolve(messages, targetMessage.id) === 0) {
                setGameOver(true);
            }
            return;
        }

        setWrongId(null);

        const settled = (targetMessage.settled_indices || []).length;
        const points = calculateSolvePoints(
            targetMessage.content,
            targetMessage.hint_level,
            consecutive,
            {
                startLevel: startLevelFor(policy, indexOf(targetMessage.id), WORDS.length),
                chargeForStartLevel: policy.chargeForStartLevel,
                // Charged for exactly as `useDailyMoves` charges: letters the
                // drip walked into place are a hint tier, and a demo that left
                // them out would quote a better score than the game pays — for
                // the very setting being edited.
                settled,
                settleCostPerLetter: policies.settle.costPerLetter,
                clueCost: policies.settle.clueCost,
            },
        );
        const nextConsecutive = streakAfterSolve(consecutive);

        setScore((prev) => prev + points);
        setConsecutive(nextConsecutive);
        finish(targetMessage, points);
        onSolved?.({
            id: targetMessage.id,
            word: targetMessage.content,
            points,
            consecutive: nextConsecutive,
            hintLevel: targetMessage.hint_level || 0,
            settled,
        });
    }, [
        guess, targetMessage, gameOver, consecutive, policy, policies.settle,
        indexOf, finish, patchTarget, messages, onSolved, onMissed,
    ]);

    const revealHint = useCallback(() => {
        if (!targetMessage || gameOver) return;

        const currentLevel = targetMessage.hint_level || 0;
        if (currentLevel >= MAX_HINT_LEVEL) return;

        const nextLevel = getNextHintLevel({
            currentLevel,
            word: targetMessage.content,
            guesses: targetMessage.guesses || [],
            progression: policy.progression,
        });

        patchTarget(targetMessage.id, hintLevelUpdates({
            word: targetMessage.content,
            currentLevel,
            nextLevel,
            currentCipher: targetMessage.cipher_text,
            clue: demoClue(indexOf(targetMessage.id)),
        }));
    }, [targetMessage, gameOver, policy.progression, indexOf, patchTarget]);

    /**
     * Ends the word for nothing — which is both what the give-up button does
     * and what the reveal at the bottom of the stuck ladder does. One function
     * rather than two identical ones: the word is marked solved for zero
     * points, so `CipherText` shows it and the chain moves on.
     */
    const giveUp = useCallback(() => {
        if (!targetMessage || gameOver) return;
        setConsecutive(0);
        setGuess('');
        finish(targetMessage, 0);
    }, [targetMessage, gameOver, finish]);

    const countdown = useAutoHint({ targetMessage, gameOver, policy, onReveal: revealHint });

    return {
        messages,
        targetMessage,
        score,
        consecutive,
        gameOver,
        guess,
        setGuess,
        wrongId,
        submit,
        revealHint,
        giveUp,
        countdown,
        patchTarget,
        indexOf,
    };
}
