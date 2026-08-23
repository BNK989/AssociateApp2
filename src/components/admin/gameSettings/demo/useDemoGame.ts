'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Message } from '@/hooks/useGameLogic';
import { calculateSimilarity } from '@/lib/gameLogic';
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
    MATCH_THRESHOLD,
    MAX_HINT_LEVEL,
    MAX_STRIKES,
} from '@/lib/daily/dailyScoring';
import { startLevelFor, type DailyHintPolicy } from '@/lib/daily/hintPolicy';
import { hintLevelUpdates } from '@/lib/daily/hintVisuals';
import { useAutoHint } from '@/components/daily/useAutoHint';
import { DEMO_CLUES, DEMO_WORDS, demoClue } from './demoChain';

const WORDS = [...DEMO_WORDS];
const CLUES = [...DEMO_CLUES];

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
 * the draft policy changes, which resets the board and the countdown together;
 * a reset path inside the hook would be a second way to do that, able to drift.
 */
export function useDemoGame(policy: DailyHintPolicy) {
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

        if (calculateSimilarity(word, targetMessage.content) < MATCH_THRESHOLD) {
            const strikes = (targetMessage.strikes || 0) + 1;
            const struckOut = strikes >= MAX_STRIKES;

            setConsecutive(0);
            setWrongId(targetMessage.id);
            patchTarget(targetMessage.id, {
                strikes,
                is_solved: struckOut,
                guesses: [...(targetMessage.guesses || []), word],
            });

            if (struckOut && countRemainingAfterSolve(messages, targetMessage.id) === 0) {
                setGameOver(true);
            }
            return;
        }

        setWrongId(null);

        const points = calculateSolvePoints(
            targetMessage.content,
            targetMessage.hint_level,
            consecutive,
            {
                startLevel: startLevelFor(policy, indexOf(targetMessage.id), WORDS.length),
                chargeForStartLevel: policy.chargeForStartLevel,
            },
        );

        setScore((prev) => prev + points);
        setConsecutive((prev) => prev + 1);
        finish(targetMessage, points);
    }, [guess, targetMessage, gameOver, consecutive, policy, indexOf, finish, patchTarget, messages]);

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
        gameOver,
        guess,
        setGuess,
        wrongId,
        submit,
        revealHint,
        giveUp,
        countdown,
    };
}
