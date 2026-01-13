'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { usePostHog, useFeatureFlagPayload } from 'posthog-js/react';
import confetti from 'canvas-confetti';
import { Message, GameState, Player } from '@/hooks/useGameLogic';
import { ChatArea } from '@/components/game/ChatArea';
import { useAuth } from '@/context/AuthProvider';
import { GameHeader } from '@/components/game/GameHeader';
import { GameInput } from '@/components/game/GameInput';
import { generateCipherString, calculateSimilarity, calculateMessageValue, HINT_COSTS } from '@/lib/gameLogic';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { DailyEndGamePopover } from '@/components/game/DailyEndGamePopover';
import { DailyGameTutorial } from '@/components/game/DailyGameTutorial';
import { GAME_CONFIG } from '@/lib/gameConfig';

type DailyGameClientProps = {
    dailyWords: string[];
    date: string;
    theme?: string;
    initialHints?: string[] | null;
};

// Mock User for Daily Game
const MEST_USER_ID = 'me';
const BOT_USER_ID = 'daily-bot';

const MOCK_USER = {
    id: MEST_USER_ID,
    email: 'guest@daily.game',
    user_metadata: {
        full_name: 'Guest Player',
        avatar_url: '',
    },
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
};

const BOT_PROFILE = {
    username: 'Daily Bot',
    avatar_url: '/logos/android-chrome-192x192.png',
};

const MY_PROFILE = {
    username: 'You',
    avatar_url: 'https://api.dicebear.com/9.x/thumbs/svg?seed=guest',
};

export default function DailyGameClient({ dailyWords, date, theme, initialHints }: DailyGameClientProps) {
    const router = useRouter();
    const { user: authUser, session, loading: authLoading } = useAuth();
    const posthog = usePostHog();
    const viewportHeight = useVisualViewport();
    const hasTrackedEntrance = useRef(false);

    // Feature Flag: Auto Hint Level
    const autoHintPayload = useFeatureFlagPayload('dailygame-auto-hint-level');
    const initialHintCount = typeof autoHintPayload === 'object' && autoHintPayload !== null && 'initialHintCount' in autoHintPayload
        ? (autoHintPayload as { initialHintCount: number }).initialHintCount
        : 0;

    useEffect(() => {
        console.log('[DailyGame] Feature Flag DEBUG:', {
            payload: autoHintPayload,
            resolvedCount: initialHintCount,
            variant: posthog.getFeatureFlag('dailygame-auto-hint-level')
        });
    }, [autoHintPayload, initialHintCount, posthog]);


    // Track Entrance
    useEffect(() => {
        if (!authLoading && !hasTrackedEntrance.current) {
            hasTrackedEntrance.current = true;
            posthog.capture('daily_game_entered', {
                user_type: authUser ? 'registered' : 'guest',
                date: date
            });
        }
    }, [authLoading, authUser, date, posthog]);

    // Game State
    const [messages, setMessages] = useState<Message[]>([]);
    const [score, setScore] = useState(0);
    const [consecutive, setConsecutive] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [showSummary, setShowSummary] = useState(false);

    // Inputs
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [shakeMessageId, setShakeMessageId] = useState<string | null>(null);
    const [justSolvedData, setJustSolvedData] = useState<{ id: string, points: number } | null>(null);
    const [showTutorial, setShowTutorial] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Check Tutorial Logic
    useEffect(() => {
        const seen = localStorage.getItem('daily_tutorial_seen');
        if (!seen) {
            // Defer update to avoid synchronous render warning? 
            // Actually, setting state in useEffect IS the way to trigger re-render after mount.
            // The warning "Calling setState synchronously within an effect" usually refers to *direct* calls?
            // "Effect callbacks are synchronous to prevent race conditions."
            // Wait, useEffect is executed AFTER render. setState there triggers re-render.
            // Maybe strict mode is complaining about something else?
            // The error message was: "Calling setState synchronously within an effect can trigger cascading renders"
            // Let's wrapping it in a requestAnimationFrame or setTimeout keeps it out of the immediate flow if needed,
            // but usually this pattern is fine. 
            // However, to satisfy the specific linter configuration here:
            requestAnimationFrame(() => setShowTutorial(true));
        }
    }, []);

    const handleTutorialComplete = () => {
        setShowTutorial(false);
        localStorage.setItem('daily_tutorial_seen', 'true');
    };

    // Initialize Game State
    useEffect(() => {
        const storageKey = `daily_game_state_${date}`;
        const savedState = localStorage.getItem(storageKey);

        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (parsed && parsed.dailyWordsJSON === JSON.stringify(dailyWords)) {
                    // Sanitize: Fix old state where Level 0 cipher length was randomized
                    const sanitizedMessages = parsed.messages.map((m: Message) => {
                        let newMessage = { ...m };
                        if (m.hint_level === 0 && (m.cipher_text?.length ?? 0) !== m.content.length) {
                            newMessage.cipher_text = generateCipherString(m.content, 0, true);
                        }
                        // Force update bot profile to use new logo
                        if (m.user_id === BOT_USER_ID) {
                            newMessage.profiles = BOT_PROFILE;
                        }
                        return newMessage;
                    });

                    setMessages(sanitizedMessages);
                    setScore(parsed.score);
                    setConsecutive(parsed.consecutive);
                    setGameOver(parsed.gameOver);
                    if (parsed.gameOver) setShowSummary(true);
                    return;
                }
            } catch (e) {
                console.error("Failed to parse saved daily game state", e);
            }
        }

        // Fallback to init if no save or mismatch
        const initMessages: Message[] = dailyWords.map((word, index) => {
            const isLast = index === dailyWords.length - 1;

            // Determine initial Hint Level for this game
            // Only the FIRST target message (the one before the start word) gets the auto hint.
            // The start word (index === length-1) is solved.
            // The first target is index === length-2.
            const isFirstTarget = index === dailyWords.length - 2;
            const targetHintLevel = isFirstTarget ? Math.max(0, Math.min(3, initialHintCount)) : 0;

            let aiHint: string | undefined = undefined;

            // Pre-fill AI hint if we are starting at max level
            if (targetHintLevel === 3) {
                aiHint = `Contains ${word.length} letters. First letter is ${word[0].toUpperCase()}.`;
                if (initialHints && initialHints[index]) {
                    aiHint = initialHints[index];
                }
            }

            return {
                id: `msg-${index}`,
                content: word,
                cipher_length: word.length,
                // If animation is enabled, start the last message as UNSOLVED (encrypted).
                // It will be solved by the animation.
                is_solved: isLast && !GAME_CONFIG.DAILY_GAME_ANIMATE_START_MESSAGE,
                user_id: BOT_USER_ID,
                created_at: new Date(Date.now() - (dailyWords.length - index) * 1000).toISOString(),
                strikes: 0,
                hint_level: targetHintLevel,
                cipher_text: generateCipherString(word, targetHintLevel, true),
                ai_hint: aiHint,
                author_points: 0,
                winner_points: 0,
                type: 'text',
                profiles: BOT_PROFILE,
                guesses: []
            };
        });

        setMessages(initMessages);
    }, [dailyWords, date, initialHintCount, initialHints]);

    // Runtime Auto-Hint Application
    // When a new target becomes active, check if it needs to be updated to the initial hint count
    useEffect(() => {
        const targetMessage = messages.slice().reverse().find(m => !m.is_solved && (m.strikes || 0) < 3);
        if (!targetMessage || gameOver) return;

        // If currently lower than the Auto Hint Level, upgrade it
        const targetLevel = Math.max(0, Math.min(3, initialHintCount));
        if (targetMessage.hint_level < targetLevel) {
            const nextLevel = targetLevel;
            // Generate new Cipher
            const newCipherText = nextLevel < 3
                ? generateCipherString(targetMessage.content, nextLevel, true)
                : (targetMessage.cipher_text || generateCipherString(targetMessage.content, 2, true));

            let aiHint = targetMessage.ai_hint;
            if (nextLevel === 3 && !aiHint) {
                aiHint = `Contains ${targetMessage.content.length} letters. First letter is ${targetMessage.content[0].toUpperCase()}.`;
                const targetIndex = dailyWords.indexOf(targetMessage.content);
                if (initialHints && initialHints[targetIndex]) {
                    aiHint = initialHints[targetIndex];
                }
            }

            setMessages(prev => prev.map(m => m.id === targetMessage.id ? {
                ...m,
                hint_level: nextLevel,
                cipher_text: newCipherText,
                ai_hint: aiHint
            } : m));
        }
    }, [messages, initialHintCount, dailyWords, initialHints, gameOver]);

    // Force update legacy avatars if they persist (fix for hot-reload/stale state)
    useEffect(() => {
        const needsUpdate = messages.some(m =>
            m.user_id === BOT_USER_ID &&
            m.profiles?.avatar_url !== BOT_PROFILE.avatar_url
        );

        if (needsUpdate) {
            setMessages(prev => prev.map(m => {
                if (m.user_id === BOT_USER_ID && m.profiles?.avatar_url !== BOT_PROFILE.avatar_url) {
                    return { ...m, profiles: BOT_PROFILE };
                }
                return m;
            }));
        }
    }, [messages]);

    // Celebrate and Show Summary on Completion
    useEffect(() => {
        if (gameOver && !showSummary) {
            // Trigger Confetti
            const duration = 1500;
            const end = Date.now() + duration;

            // Fire some confetti
            const fireConfetti = () => {
                const count = 200;
                const defaults = {
                    origin: { y: 0.7 }
                };

                const fire = (particleRatio: number, opts: confetti.Options) => {
                    confetti({
                        ...defaults,
                        ...opts,
                        particleCount: Math.floor(count * particleRatio)
                    });
                };

                fire(0.25, { spread: 26, startVelocity: 55 });
                fire(0.2, { spread: 60 });
                fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
                fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
                fire(0.1, { spread: 120, startVelocity: 45 });
            };

            fireConfetti();

            // Delay showing the summary popup
            const timer = setTimeout(() => {
                setShowSummary(true);
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [gameOver, showSummary]);
    useEffect(() => {
        if (messages.length === 0) return;

        const storageKey = `daily_game_state_${date}`;
        const stateToSave = {
            messages,
            score,
            consecutive,
            gameOver,
            dailyWordsJSON: JSON.stringify(dailyWords)
        };
        localStorage.setItem(storageKey, JSON.stringify(stateToSave));

        // Save simple completion flag for external UI check
        if (gameOver) {
            localStorage.setItem(`daily_game_completed_${date}`, 'true');
        }
    }, [messages, score, consecutive, gameOver, date, dailyWords]);

    // Derived Game Object
    const gameState: GameState = {
        id: 'daily-game',
        handle: 1,
        status: gameOver ? 'completed' : 'solving',
        mode: 'free',
        current_turn_user_id: MEST_USER_ID, // Always my turn
        team_pot: 0,
        team_consecutive_correct: consecutive,
        fever_mode_remaining: 0,
        solve_proposal_confirmations: [],
        max_messages: dailyWords.length
    };

    const players: Player[] = [
        {
            user_id: MEST_USER_ID,
            score: score,
            joined_at: new Date().toISOString(),
            consecutive_correct_guesses: consecutive,
            profiles: MY_PROFILE
        },
        {
            user_id: BOT_USER_ID,
            score: 0,
            joined_at: new Date().toISOString(),
            consecutive_correct_guesses: 0,
            profiles: BOT_PROFILE
        }
    ];

    const getTargetMessage = () => {
        const reversed = [...messages].reverse();
        return reversed.find(m => !m.is_solved && (m.strikes || 0) < 3);
    };

    const targetMessage = getTargetMessage();

    // Auto-scroll to target message
    useEffect(() => {
        if (targetMessage) {
            // Small timeout to ensure DOM update
            setTimeout(() => {
                const element = document.getElementById(`msg-${targetMessage.id}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetMessage?.id]);

    // Hint Logic
    const handleGetHint = async () => {
        if (!targetMessage || gameOver) return;

        const currentLevel = targetMessage.hint_level || 0;
        if (currentLevel >= 3) return;

        let nextLevel = currentLevel + 1;

        // Smart Hint Skip: If first letter is already revealed (Green OR Orange), skip Level 1 (Reveal First)
        const firstLetter = targetMessage.content[0]?.toLowerCase();
        const isFirstLetterRevealed = targetMessage.guesses?.some(g => g.toLowerCase().includes(firstLetter));

        if (currentLevel === 0 && isFirstLetterRevealed) {
            nextLevel = 2;
        }

        // const wordValue = calculateMessageValue(targetMessage.content);

        // Calculate Cost (unused currently, but kept for future logic or removed to satisfy lint)
        // let deduction = 0;
        // if (nextLevel === 1) deduction = Math.ceil(wordValue * HINT_COSTS.TIER_1);
        // else if (nextLevel === 2) deduction = Math.ceil(wordValue * HINT_COSTS.TIER_2);
        // else if (nextLevel === 3) deduction = Math.ceil(wordValue * HINT_COSTS.TIER_3);
        // To fix lint: we just remove the deduction logic since it's not applied here.
        // It is applied in handleSolve or similar.

        // Generate new Cipher (Static Fallback)
        // Only regenerate for Level 1 and 2. Level 3 should preserve the visual state.
        const newCipherText = nextLevel < 3
            ? generateCipherString(targetMessage.content, nextLevel, true)
            : (targetMessage.cipher_text || generateCipherString(targetMessage.content, 2, true));

        // Update Message
        const updates: Partial<Message> = {
            hint_level: nextLevel,
            cipher_text: newCipherText
        };

        if (nextLevel === 3) {
            let aiHint = `Contains ${targetMessage.content.length} letters. First letter is ${targetMessage.content[0].toUpperCase()}.`;

            // Use preloaded hints if available
            if (initialHints && Array.isArray(initialHints)) {
                const targetIndex = dailyWords.indexOf(targetMessage.content);
                if (targetIndex !== -1 && initialHints[targetIndex]) {
                    aiHint = initialHints[targetIndex];
                }
            } else {
                // Fallback to fetch if for some reason hints weren't loaded (e.g. error, or old API style)
                try {
                    // Extract index from ID "msg-0", "msg-1"
                    const targetIndex = dailyWords.indexOf(targetMessage.content);

                    if (targetIndex !== -1) {
                        // We can trigger the fetch in background or await it.
                        // Requirement: "subtle loading or nothing".
                        // We'll await it to ensure we display the AI hint if successful, otherwise static.

                        const headersMs: Record<string, string> = {
                            'Content-Type': 'application/json',
                        };

                        if (session?.access_token) {
                            headersMs['Authorization'] = `Bearer ${session.access_token}`;
                        }

                        const res = await fetch('/api/daily/hint', {
                            method: 'POST',
                            headers: headersMs,
                            body: JSON.stringify({
                                date: date,
                                targetIndex: targetIndex
                            })
                        });

                        if (res.ok) {
                            const data = await res.json();
                            if (data.hint) {
                                aiHint = data.hint;
                            }
                        } else {
                            const err = await res.json();
                            if (err.error === 'Limit reached for this game' || err.error === 'Daily IP limit reached') {
                                toast.error("Daily AI Hint limit reached");
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch AI hint", e);
                }
            }

            updates.ai_hint = aiHint;
        }

        setMessages(prev => prev.map(m => m.id === targetMessage.id ? { ...m, ...updates } : m));
        // toast.info(`Hint Level ${nextLevel} Applied!`);
    };

    const handleGiveUp = () => {
        if (!targetMessage || gameOver) return;

        setMessages(prev => prev.map(m => m.id === targetMessage.id ? {
            ...m,
            is_solved: true,
            solved_by: MEST_USER_ID,
            winner_points: 0
        } : m));

        setConsecutive(0);
        // toast.info(`Gave up on word: ${targetMessage.content}`);

        // Check Completion
        // Need to check remaining messages excluding the just solved one
        const remaining = messages.filter(m => !m.is_solved && m.id !== targetMessage.id && (m.strikes || 0) < 3).length;
        if (remaining === 0) {
            setGameOver(true);
            toast.success("Daily Challenge Completed!");
        }

        setInput('');
    };

    const handleSolve = (guess: string) => {
        if (!targetMessage) return;

        const similarity = calculateSimilarity(guess, targetMessage.content);
        const isMatch = similarity >= 0.8;

        // Simulate Network Delay
        setSending(true);
        setTimeout(() => {
            setSending(false);

            if (isMatch) {
                const baseValue = calculateMessageValue(targetMessage.content);

                // Deductions based on hint level
                let deductionMultiplier = 0;
                if (targetMessage.hint_level >= 1) deductionMultiplier += HINT_COSTS.TIER_1;
                if (targetMessage.hint_level >= 2) deductionMultiplier += HINT_COSTS.TIER_2;
                if (targetMessage.hint_level >= 3) deductionMultiplier += HINT_COSTS.TIER_3;

                const points = Math.floor(baseValue * (1 - deductionMultiplier) * (consecutive >= 3 ? 1.5 : 1));

                setScore(prev => prev + points);
                setConsecutive(prev => prev + 1);

                setMessages(prev => prev.map(m => m.id === targetMessage.id ? {
                    ...m,
                    is_solved: true,
                    solved_by: MEST_USER_ID,
                    winner_points: points
                } : m));

                setJustSolvedData({ id: targetMessage.id, points });
                setTimeout(() => setJustSolvedData(null), 1500);

                // Track Word Solved
                posthog.capture('daily_word_solved', {
                    word: targetMessage.content,
                    score_gained: points,
                    total_score: score + points,
                    consecutive: consecutive + 1,
                    user_type: authUser ? 'registered' : 'guest',
                    date: date
                });

                // Check Completion
                const remaining = messages.filter(m => !m.is_solved && m.id !== targetMessage.id && (m.strikes || 0) < 3).length;
                if (remaining === 0) {
                    setGameOver(true);
                    toast.success("Daily Challenge Completed!");

                    // Track Completion
                    posthog.capture('daily_game_completed', {
                        final_score: score + points,
                        total_words: dailyWords.length,
                        user_type: authUser ? 'registered' : 'guest',
                        date: date
                    });
                }


                setInput('');

            } else {
                const newStrikes = (targetMessage.strikes || 0) + 1;
                // Add the wrong guess to the message's guesses array
                const newGuesses = [...(targetMessage.guesses || []), guess];

                setMessages(prev => prev.map(m => m.id === targetMessage.id ? {
                    ...m,
                    strikes: newStrikes,
                    is_solved: newStrikes >= 3 ? true : false,
                    guesses: newGuesses
                } : m));

                setConsecutive(0);
                setShakeMessageId(targetMessage.id);
                setTimeout(() => setShakeMessageId(null), 500);

                if (newStrikes >= 3) {
                    toast.error(`Lost word: ${targetMessage.content}`);
                } else {
                    // toast.error(`Incorrect! Strike ${newStrikes}/3`);
                }
                setInput('');
            }
        }, 300); // 300ms fake delay
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || sending) return;
        handleSolve(input.trim());
    };

    // Calculate time left (Mock)
    const solvingTimeLeft = 20;

    const handleTestEndSequence = () => {
        setGameOver(true);
        setShowSummary(false);
    };

    const handleResetGame = () => {
        const storageKey = `daily_game_state_${date}`;
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`daily_game_completed_${date}`);

        // Re-initialize state
        const initMessages: Message[] = dailyWords.map((word, index) => {
            const isLast = index === dailyWords.length - 1;
            return {
                id: `msg-${index}`,
                content: word,
                cipher_length: word.length,
                is_solved: isLast,
                user_id: BOT_USER_ID,
                created_at: new Date(Date.now() - (dailyWords.length - index) * 1000).toISOString(),
                strikes: 0,
                hint_level: 0,
                cipher_text: generateCipherString(word, 0, true),
                author_points: 0,
                winner_points: 0,
                type: 'text',
                profiles: BOT_PROFILE,
                guesses: []
            };
        });

        setMessages(initMessages);
        setScore(0);
        setConsecutive(0);
        setGameOver(false);
        setShowSummary(false);
        setInput('');

        toast.success("Game reset to initial state");
    };

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white dark:bg-gray-900 max-w-md mx-auto"
            style={{ height: viewportHeight }}
        >
            <GameHeader
                game={gameState}
                user={MOCK_USER}
                players={players}
                loading={false}
                proposalTimeLeft={null}
                solvingTimeLeft={solvingTimeLeft}
                targetMessage={targetMessage}
                messageCount={messages.length}
                maxMessages={dailyWords.length}
                onBack={() => router.push('/')}
                onRefresh={() => { }}
                onProposeSolving={() => { }}
                onConfirmSolving={() => { }}
                onDenySolving={() => { }}
                onLeave={() => router.push('/')}
                skipExitConfirm={true}
                theme={theme}
                hideAvatars={true}
                hideBank={true}
                date={date}
                solvedCount={messages.filter(m => m.is_solved).length}
                showTutorial={showTutorial}
                onWelcomeComplete={() => {
                    if (!GAME_CONFIG.DAILY_GAME_ANIMATE_START_MESSAGE) return;

                    const startMsgIndex = messages.findIndex(m => m.content === dailyWords[dailyWords.length - 1]);
                    const startMsg = messages[startMsgIndex];

                    // Only animate if it exists and is NOT solved yet
                    if (startMsg && !startMsg.is_solved) {
                        const fullText = startMsg.content;
                        let currentText = '';
                        let charIndex = 0;

                        const typeInterval = setInterval(() => {
                            if (charIndex < fullText.length) {
                                currentText += fullText[charIndex];
                                setInput(currentText);
                                charIndex++;
                            } else {
                                clearInterval(typeInterval);
                                // Solve it after short delay
                                setTimeout(() => {
                                    // Manual Solve (0 points)
                                    setMessages(prev => prev.map(m => m.id === startMsg.id ? {
                                        ...m,
                                        is_solved: true,
                                        solved_by: MEST_USER_ID,
                                        winner_points: 0 // 0 Points as requested
                                    } : m));

                                    // Visual feedback for solve
                                    setJustSolvedData({ id: startMsg.id, points: 0 });
                                    setTimeout(() => setJustSolvedData(null), 1500);

                                    setInput('');
                                }, 300);
                            }
                        }, 50); // 50ms per char
                    }
                }}
            />

            <ChatArea
                messages={messages}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                user={MOCK_USER as any}
                game={gameState}
                messagesEndRef={messagesEndRef}
                targetMessage={targetMessage}
                shakeMessageId={shakeMessageId}
                justSolvedData={justSolvedData}
                players={players}
                onTestEndSequence={handleTestEndSequence}
                onResetGame={handleResetGame}
            />

            <GameInput
                game={gameState}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                user={MOCK_USER as any}
                players={players}
                input={input}
                setInput={setInput}
                sending={sending}
                solvingTimeLeft={solvingTimeLeft}
                targetMessage={targetMessage}
                onSendMessage={handleSendMessage}
                onGetHint={handleGetHint}
                isEmpty={false}
                isSinglePlayer={true}
                onGiveUp={handleGiveUp}
            />

            {/* Daily End Game Popover */}
            <DailyEndGamePopover
                open={showSummary}
                score={score}
                totalWords={dailyWords.length}
                date={date}
                onClose={() => router.push('/')}
            />

            {/* Daily Game Tutorial */}
            <DailyGameTutorial
                open={showTutorial}
                onComplete={handleTutorialComplete}
            />
        </div>
    );
}
