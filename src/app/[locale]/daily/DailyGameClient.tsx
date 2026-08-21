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
import { generateCipherString, calculateSimilarity, calculateMessageValue, HINT_COSTS, calculateRevealedPercentage } from '@/lib/gameLogic';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { DailyEndGamePopover } from '@/components/game/DailyEndGamePopover';
import { DailyGameTutorial } from '@/components/game/DailyGameTutorial';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { supabase } from '@/lib/supabase';

type DailyGameClientProps = {
    dailyWords: string[];
    date: string;
    theme?: string;
    initialHints?: string[] | null;
    initialConnectionScores?: number[] | null;
};

// Mock User for Daily Game
const MEST_USER_ID = 'me';
import type { User } from '@supabase/supabase-js';

const BOT_USER_ID = 'daily-bot';

const MOCK_USER: User = {
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

import { useTranslations } from 'next-intl';
import { WalkthroughProvider, useWalkthrough, WalkthroughStep } from '@/components/ui/walkthrough';
import { createLogger } from '@/lib/logger';

const log = createLogger('daily/client');

export default function DailyGameClient(props: DailyGameClientProps) {
    return (
        <WalkthroughProvider>
            <DailyGameBoard {...props} />
        </WalkthroughProvider>
    );
}

function DailyGameBoard({ dailyWords, date, theme, initialHints, initialConnectionScores }: DailyGameClientProps) {
    const router = useRouter();
    const { user: authUser, session, loading: authLoading, profile } = useAuth();
    const posthog = usePostHog();
    const t = useTranslations('GameRoom.Chat');
    const tTour = useTranslations('GameRoom.Info.Daily.tutorial');
    const { startTour } = useWalkthrough();
    const viewportHeight = useVisualViewport();
    const hasTrackedEntrance = useRef(false);
    const prevTargetIdRef = useRef<string | null>(null);

    // Feature Flag: Auto Hint Level
    const autoHintPayload = useFeatureFlagPayload('dailygame-auto-hint-level');
    const initialHintCount = typeof autoHintPayload === 'object' && autoHintPayload !== null && 'initialHintCount' in autoHintPayload
        ? (autoHintPayload as { initialHintCount: number }).initialHintCount
        : 0;


    // Audio Refs
    const successAudioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Preload Success Audio
        if (typeof window !== 'undefined') {
            const audio = new Audio('/sounds/notifications/correct-choice.mp3');
            audio.volume = 0.6;
            audio.preload = 'auto';
            successAudioRef.current = audio;
        }
    }, []);

    useEffect(() => {
        log.debug('feature_flag', 'Auto-hint feature flag resolved', {
            payload: JSON.stringify(autoHintPayload),
            resolved_count: initialHintCount,
            variant: String(posthog.getFeatureFlag('dailygame-auto-hint-level')),
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

    // Auto-Hint State
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [autoHintEnabled, setAutoHintEnabled] = useState(GAME_CONFIG.DEFAULT_AUTO_HINT_ENABLED);
    const [autoHintDuration, setAutoHintDuration] = useState(GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION);
    const [autoHintTimer, setAutoHintTimer] = useState(0);
    const [isHintPaused, setIsHintPaused] = useState(false);

    const handleRestartTutorial = () => {
        localStorage.removeItem('daily_tutorial_seen');
        startTour([
            {
                id: 'step-intro',
                targetId: '',
                title: tTour('step1_title'),
                content: tTour('step1_desc'),
                position: 'center'
            },
            {
                id: 'step-input',
                targetId: 'game-input-area',
                title: tTour('step2_title'),
                content: tTour('step2_desc'),
                position: 'top'
            },
            {
                id: 'step-colors',
                targetId: 'msg-msg-' + (dailyWords.length - 2).toString(),
                title: tTour('step3_title'),
                content: tTour('step3_desc'),
                position: 'top'
            },
            {
                id: 'step-hint',
                targetId: 'hint-button-trigger',
                title: tTour('step4_title'),
                content: tTour('step4_desc'),
                position: 'top'
            }
        ], {
            onComplete: () => {
                localStorage.setItem('daily_tutorial_seen', 'true');
                posthog.capture('daily_tutorial_restarted_completed', { date });
            },
            onSkip: () => {
                localStorage.setItem('daily_tutorial_seen', 'true');
                posthog.capture('daily_tutorial_restarted_skipped', { date });
            }
        });
    };

    // Helper to calculate progress (0-100)
    const autoHintProgress = autoHintDuration > 0 ? ((autoHintDuration - autoHintTimer) / autoHintDuration) * 100 : 0;

    const getTargetMessage = () => {
        const reversed = [...messages].reverse();
        return reversed.find(m => !m.is_solved && (m.strikes || 0) < 3);
    };

    const targetMessage = getTargetMessage();

    // Load Settings
    useEffect(() => {
        const loadSettings = async () => {
            if (authUser) {
                // Fetch from Supabase profile if possible, or assume InfoScreen will update context/profile eventually?
                // For direct access, we query profiles table.
                const { data } = await supabase.from('profiles').select('settings').eq('id', authUser.id).single();
                if (data?.settings) {
                    setAutoHintEnabled(data.settings.auto_hint_enabled ?? GAME_CONFIG.DEFAULT_AUTO_HINT_ENABLED);
                    setAutoHintDuration(data.settings.auto_hint_duration ?? GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION);
                }
            } else {
                const localSettings = localStorage.getItem('daily_game_settings');
                if (localSettings) {
                    try {
                        const parsed = JSON.parse(localSettings);
                        setAutoHintEnabled(parsed.auto_hint_enabled ?? GAME_CONFIG.DEFAULT_AUTO_HINT_ENABLED);
                        setAutoHintDuration(parsed.auto_hint_duration ?? GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION);
                    } catch (e) { }
                }
            }
        };
        loadSettings();
    }, [authUser]);

    const instantLoopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Timer Logic
    useEffect(() => {
        // Reset timer if target changes or game over
        // We now use the derived targetMessage from outer scope

        if (!targetMessage || gameOver || !autoHintEnabled) {
            // If disabled or non-existent, reset to 0 or paused state
            setAutoHintTimer(autoHintDuration > 0 ? autoHintDuration : 0);
            prevTargetIdRef.current = null;
            if (instantLoopTimeoutRef.current) {
                clearTimeout(instantLoopTimeoutRef.current);
                instantLoopTimeoutRef.current = null;
            }
            return;
        }

        // Detect Target Change OR Duration Change -> Reset Timer
        // We want to reset IF:
        // 1. Target ID Changed
        // 2. Duration CHANGED (User updated settings)
        // BUT: If strict equality on duration fails (e.g. 0 -> 10), we reset.
        // Wait, if we are in the middle of a countdown (e.g. 5s left of 10s) and user changes to 20s, do we reset to 20? Yes.
        // If user changes to Instant (0s), do we reset? Yes.

        // We track prev duration to know if it changed
        // Actually, just checking if target changed OR if current timer > new duration (clamp) OR just mostly syncing.
        // Simplest: If target changed, definite reset.
        if (targetMessage.id !== prevTargetIdRef.current) {
            setAutoHintTimer(autoHintDuration);
            prevTargetIdRef.current = targetMessage.id;
            // Clear any pending instant loop
            if (instantLoopTimeoutRef.current) {
                clearTimeout(instantLoopTimeoutRef.current);
                instantLoopTimeoutRef.current = null;
            }
        }

        // If Duration is 0 (Instant) and we aren't in the loop/timer is > 0, we should force it to 0 to kickoff the loop.
        // But the loop handles 0.1 -> 0.
        // If user switches 10 -> 0. autoHintTimer might be 7. 
        // We need to force it to 0 if duration is 0.
        /* 
           Crucial Check: If the settings changed to "Instant" but the timer is still ticking down from the old duration,
           we need to preemptively set it to 0.
        */
        if (autoHintDuration <= 0 && autoHintTimer > 0.1) {
            setAutoHintTimer(0);
        }


        if (isHintPaused) return;

        // If target exists and not paused, tick
        const interval = setInterval(() => {
            setAutoHintTimer(prev => {
                if (prev <= 1) {
                    // Trigger Hint!
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [targetMessage, gameOver, autoHintEnabled, isHintPaused, autoHintDuration]);

    // Auto-Reveal Effect
    useEffect(() => {
        if (autoHintTimer === 0 && autoHintEnabled && !isHintPaused && !gameOver) {
            const currentTarget = messages.slice().reverse().find(m => !m.is_solved && (m.strikes || 0) < 3);
            if (currentTarget) {
                // Check if we can hint
                if ((currentTarget.hint_level || 0) < 3) {
                    // Call handleGetHint
                    handleGetHint();

                    // Reset timer
                    if (autoHintDuration <= 0) {
                        // "Instant" Mode: Short delay then re-trigger
                        // We toggle to a small non-zero value (0.1) then back to 0 to ensure the useEffect fires again
                        setAutoHintTimer(0.1);

                        // Clear prev
                        if (instantLoopTimeoutRef.current) clearTimeout(instantLoopTimeoutRef.current);

                        instantLoopTimeoutRef.current = setTimeout(() => {
                            setAutoHintTimer(0);
                            instantLoopTimeoutRef.current = null;
                        }, 500);
                    } else {
                        // Normal Reset
                        setAutoHintTimer(autoHintDuration);
                        if (instantLoopTimeoutRef.current) {
                            clearTimeout(instantLoopTimeoutRef.current);
                            instantLoopTimeoutRef.current = null;
                        }
                    }
                }
            }
        }
    }, [autoHintTimer, autoHintEnabled, isHintPaused, gameOver, targetMessage?.id]);
    // Actually handleGetHint relies on `targetMessage` which is derived from `messages`.
    // It's safe to call it.


    // Inputs
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [shakeMessageId, setShakeMessageId] = useState<string | null>(null);
    const [justSolvedData, setJustSolvedData] = useState<{ id: string, points: number } | null>(null);
    const [showTutorial, setShowTutorial] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load Settings
    const loadSettings = async () => {
        if (authUser) {
            const { data } = await supabase.from('profiles').select('settings').eq('id', authUser.id).single();
            if (data?.settings) {
                setAutoHintEnabled(data.settings.auto_hint_enabled ?? GAME_CONFIG.DEFAULT_AUTO_HINT_ENABLED);
                setAutoHintDuration(data.settings.auto_hint_duration ?? GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION);
            }
        } else {
            const localSettings = localStorage.getItem('daily_game_settings');
            // Also check for legacy or default
            if (localSettings) {
                try {
                    const parsed = JSON.parse(localSettings);
                    setAutoHintEnabled(parsed.auto_hint_enabled ?? GAME_CONFIG.DEFAULT_AUTO_HINT_ENABLED);
                    setAutoHintDuration(parsed.auto_hint_duration ?? GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION);
                } catch (e) { }
            }
        }
    };

    useEffect(() => {
        loadSettings();
    }, [authUser]);

    // Walkthrough Logic
    useEffect(() => {
        const checkAndStartTour = async () => {
            // 1. Check LocalStorage (Fastest)
            const localSeen = localStorage.getItem('daily_tutorial_seen');
            if (localSeen === 'true') return;

            // 2. Check Supabase (if logged in)
            if (authUser) {
                const { data } = await supabase.from('profiles').select('settings').eq('id', authUser.id).single();
                if (data?.settings?.daily_tutorial_seen) {
                    // Sync to local
                    localStorage.setItem('daily_tutorial_seen', 'true');
                    return;
                }
            }

            // 3. Start Tour
            // Wait a moment for UI to settle
            setTimeout(() => {
                startTour([
                    {
                        id: 'step-intro',
                        targetId: '', // Empty string to indicate no specific target
                        title: tTour('step1_title'),
                        content: tTour('step1_desc'),
                        position: 'bottom'
                    },
                    {
                        id: 'step-input',
                        targetId: 'game-input-area', // Need to add this ID to GameInput
                        title: tTour('step2_title'),
                        content: tTour('step2_desc'),
                        position: 'top'
                    },
                    // We need a dummy message to point to for "Colors"
                    // If no message exists yet, we should probably skip this or point to input
                    {
                        id: 'step-colors',
                        targetId: 'msg-msg-' + (dailyWords.length - 2).toString(), // Target the first unsolved message
                        title: tTour('step3_title'),
                        content: tTour('step3_desc'),
                        position: 'top'
                    },
                    {
                        id: 'step-hint',
                        targetId: 'hint-button-trigger', // Need to add this ID to GameInput (Hint Trigger)
                        title: tTour('step4_title'),
                        content: tTour('step4_desc'),
                        position: 'top',
                        onNext: () => {
                            // Mark as seen on completion
                            localStorage.setItem('daily_tutorial_seen', 'true');
                            if (authUser) {
                                const updateSettings = async () => {
                                    // Get current settings first to merge
                                    const { data } = await supabase.from('profiles').select('settings').eq('id', authUser.id).single();
                                    const currentSettings = data?.settings || {};
                                    await supabase.from('profiles').update({
                                        settings: { ...currentSettings, daily_tutorial_seen: true }
                                    }).eq('id', authUser.id);
                                };
                                updateSettings();
                            }
                        }
                    }
                ]);
            }, 1000);
        };

        if (!authLoading && dailyWords.length > 0) {
            checkAndStartTour();
        }
    }, [authLoading, authUser, startTour, dailyWords, tTour]);

    // Reload settings when Info Screen closes to capture changes
    useEffect(() => {
        if (!isInfoOpen) {
            loadSettings();
        }
    }, [isInfoOpen]);

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
                        const newMessage = { ...m };
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
                log.error('restore_state', 'Failed to parse saved daily game state from localStorage', { play_date: date }, e);
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
                aiHint = t('hint_fallback', { length: word.length, firstLetter: word[0].toUpperCase() });
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
                connection_score: initialConnectionScores?.[index] ?? undefined,
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
                aiHint = t('hint_fallback', { length: targetMessage.content.length, firstLetter: targetMessage.content[0].toUpperCase() });
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

        // Configurable Reveal Type: "ALL" -> Reveal ALL hints at once (Jump straight to Level 3)
        // This overrides any previous logic (e.g. smart skip) and applies regardless of current level (0, 1, or 2)
        if (GAME_CONFIG.DEFAULT_AUTO_HINT_REVEAL_TYPE === 'ALL') {
            nextLevel = 3;
        }

        // Hint 2 Skip: If ALREADY >66% revealed, skip Hint 2 (Scramble) and go straight to Hint 3 (AI)
        // because Hint 2 would be redundant/useless.
        if ((currentLevel === 1 || nextLevel === 2) && nextLevel !== 3) {
            const revealedPct = calculateRevealedPercentage(targetMessage.content, targetMessage.guesses || []);
            if (revealedPct >= GAME_CONFIG.PERCENT_REVEALED_SHUFFLE_HINT) {
                nextLevel = 3;
            }
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
        // If jumping to Level 3 (AI) from regular levels, ensures we apply the Level 2 (Scramble) visuals if not already there.
        const shouldGenerateLevel2Visuals = nextLevel === 3 && currentLevel < 2;

        const newCipherText = (nextLevel < 3 || shouldGenerateLevel2Visuals)
            ? generateCipherString(targetMessage.content, Math.min(nextLevel, 2), true)
            : (targetMessage.cipher_text || generateCipherString(targetMessage.content, 2, true));

        // Update Message
        const updates: Partial<Message> = {
            hint_level: nextLevel,
            cipher_text: newCipherText
        };

        if (nextLevel === 3) {
            let aiHint = t('hint_fallback', { length: targetMessage.content.length, firstLetter: targetMessage.content[0].toUpperCase() });

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
                                toast.error(t('toast_daily_limit'));
                            }
                        }
                    }
                } catch (e) {
                    log.error('fetch_hint', 'Failed to fetch AI hint', { play_date: date }, e);
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
                // Check Audio Setting (Auth vs Guest)
                let audioEnabled = true;
                if (profile?.settings?.enable_audio_chime !== undefined) {
                    audioEnabled = profile.settings.enable_audio_chime;
                } else {
                    try {
                        const local = localStorage.getItem('daily_game_settings');
                        if (local) {
                            const parsed = JSON.parse(local);
                            if (parsed.enable_audio_chime !== undefined) {
                                audioEnabled = parsed.enable_audio_chime;
                            }
                        }
                    } catch (e) { }
                }

                if (audioEnabled && successAudioRef.current) {
                    successAudioRef.current.currentTime = 0;
                    successAudioRef.current.play().catch((e) => log.warn('play_audio', 'Success sound playback failed', undefined, e));
                }

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
                    toast.error(t('toast_word_lost', { word: targetMessage.content }));
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

        toast.success(t('toast_reset_success'));
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
                onRestartTutorial={handleRestartTutorial}
                externalShowInfo={isInfoOpen}
                onInfoToggle={setIsInfoOpen}
                onAutoHintChange={(enabled, duration) => {
                    setAutoHintEnabled(enabled);
                    setAutoHintDuration(duration);
                }}
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
                user={MOCK_USER}
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
                user={MOCK_USER}
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
                autoHintProgress={autoHintProgress}
                autoHintSecondsLeft={autoHintTimer}
                isAutoHintActive={autoHintEnabled && !gameOver && !!targetMessage && autoHintDuration > 0}
                isHintPaused={isHintPaused}
                onToggleHintPause={() => setIsHintPaused(prev => !prev)}
                onOpenSettings={() => setIsInfoOpen(true)}
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
