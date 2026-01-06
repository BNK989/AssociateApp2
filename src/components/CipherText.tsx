'use client';
import { useEffect, useState, useRef } from 'react';
import { motion } from "framer-motion";

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
// Special chars used for hinting (must match gameLogic.ts)
const SPECIAL_CHARS = new Set(['~', '•', '$', '^', '+', '*', '=', '?', '#', '@', '&', '%']);

interface CipherTextProps {
    text: string;
    cipherText?: string;
    visible: boolean;
    className?: string;
    isSolving?: boolean;
    hintLevel?: number;
    forceScramble?: number;
}

interface ScrambleItem {
    char: string;
    id: string; // Stable ID for layout animations
    isSpace: boolean;
    isReal: boolean; // Tracking if it's a real char (Sans) or filler (Mono) during scramble
}

export function CipherText({ text, cipherText, visible, className = '', isSolving = false, hintLevel = 0, forceScramble }: CipherTextProps) {
    const cipherRef = useRef<string>('');

    // Initialize cipher string lazily, but PREFER cipherText if available
    if (!cipherRef.current) {
        if (cipherText) {
            cipherRef.current = cipherText;
        } else {
            cipherRef.current = text.split('').map((originalChar) => {
                if (originalChar === ' ') return ' ';
                let randomChar;
                do {
                    randomChar = CHARS[Math.floor(Math.random() * CHARS.length)];
                } while (randomChar === originalChar);
                return randomChar;
            }).join('');
        }
    }

    const [display, setDisplay] = useState(visible ? text : (cipherText || cipherRef.current));
    // For Scramble Effect: We use an array of items to allow layout animations
    const [scrambleItems, setScrambleItems] = useState<ScrambleItem[] | null>(null);
    const lastForceScrambleRef = useRef<number>(forceScramble || 0);

    const isFirstRender = useRef(true);

    useEffect(() => {
        // Update local cipher ref if prop changes (e.g. new hint bought)
        if (cipherText) {
            cipherRef.current = cipherText;
            if (!visible && !scrambleItems) {
                setDisplay(cipherText);
            }
        }
    }, [cipherText, visible, scrambleItems]);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        let isCancelled = false;

        const animate = async () => {
            // Target is what we want to end up at
            const target = visible ? text : (cipherText || cipherRef.current);
            const start = display;

            // 0. Handle Exit from Scramble Mode (Reveal)
            if (visible && scrambleItems) {
                setScrambleItems(null);
                setDisplay(text);
                return;
            }

            const isForced = forceScramble && forceScramble > lastForceScrambleRef.current;
            if (isForced) {
                lastForceScrambleRef.current = forceScramble!;
            }

            // Conditions to skip: 
            // 1. Matched state and no forced animation
            // 2. Already scrambling (unless forced re-trigger?)
            if (display === target && !scrambleItems && !isForced) return;

            // PRE-ANIMATION: Scramble Effect for Hint Level 2
            if ((!visible && hintLevel >= 2) || isForced) {
                const duration = 600; // time to settle
                const shuffles = Math.floor(Math.random() * 5) + 2;
                const interval = duration / shuffles;

                // Create stable items from the TARGET string (the Anagram)
                const baseItems: ScrambleItem[] = target.split('').map((c, i) => {
                    // Determined style: if it matches the Real Text (case insensitive) -> Sans (Real)
                    // Note: Level 2 reveals 70% real chars. Fillers are Mono special chars.
                    // For Hint 2: Real letters are those that ARE NOT special cipher chars
                    // We also check text.includes for safety, but primarily !isSpecial for Hint 2
                    const isSpecial = SPECIAL_CHARS.has(c);
                    const isReal = !isSpecial && text.toLowerCase().includes(c.toLowerCase()) && c !== ' ';
                    return {
                        char: c,
                        // Use STABLE ID matching the static render key to prevent unmount/mount flash
                        id: `${i}-${c}`,
                        isSpace: c === ' ',
                        isReal
                    };
                });

                // Initial shuffle
                const shuffledStart = generateShuffledView(baseItems);
                setScrambleItems(shuffledStart);

                for (let i = 0; i < shuffles; i++) {
                    if (isCancelled) return;
                    await new Promise(r => setTimeout(r, interval));

                    if (i === shuffles - 1) {
                        // Final step: settle to A RANDOM configuration, not the base order
                        // This ensures that "re-scrambling" actually changes the positions
                        const finalShuffle = generateShuffledView(baseItems);
                        setScrambleItems(finalShuffle);
                    } else {
                        // Shuffle again
                        setScrambleItems(prev => prev ? generateShuffledView(prev) : baseItems);
                    }
                }

                await new Promise(r => setTimeout(r, 500));

                if (!isCancelled) {
                    // If we are still in Hint 2 mode, keep the scrambled items as the view
                    // This persists the random order and the glow effect
                    if (!visible && hintLevel >= 2) {
                        // Do not clear.
                    } else {
                        setDisplay(target);
                        setScrambleItems(null);
                    }
                }
                return;
            }

            // Standard Morph Animation (Level 1 or Solve)
            if (!scrambleItems) {
                const steps = Math.max(text.length, cipherRef.current.length);
                const stepDuration = Math.max(30, Math.min(100, 1000 / steps));

                for (let i = 0; i <= steps; i++) {
                    if (isCancelled) return;

                    if (visible) {
                        setDisplay(text.slice(0, i) + cipherRef.current.slice(i));
                    } else {
                        const targetPart = target.slice(0, i);
                        const startPart = start.slice(i);
                        setDisplay(targetPart + startPart);
                    }

                    await new Promise(r => setTimeout(r, stepDuration));
                }
                if (!isCancelled) setDisplay(target);
            }
        };

        animate();
        return () => { isCancelled = true; };
    }, [visible, text, cipherText, hintLevel, forceScramble]);

    // Track previous cipher to detect changes (Hint Reveals)
    const prevCipherRef = useRef(cipherText || '');
    const [changedIndices, setChangedIndices] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (visible) return;

        const currentCipher = cipherText || '';
        const prevCipher = prevCipherRef.current;

        if (currentCipher !== prevCipher) {
            const newChanged = new Set<number>();
            const len = Math.max(currentCipher.length, prevCipher.length);
            for (let i = 0; i < len; i++) {
                const charNow = currentCipher[i] || '';
                const charPrev = prevCipher[i] || '';
                if (charNow !== charPrev && charNow === text[i]) {
                    newChanged.add(i);
                }
            }

            if (newChanged.size > 0) {
                setChangedIndices(newChanged);
                const timer = setTimeout(() => setChangedIndices(new Set()), 1000);
                return () => clearTimeout(timer);
            }
            prevCipherRef.current = currentCipher;
        }
    }, [cipherText, visible, text]);

    // Render logic
    const showColons = !visible && !cipherText;
    const COLON = '\u2237';

    // Animation variants
    const bounceVariant = {
        bounce: (i: number) => ({
            y: [0, -3, 0],
            transition: {
                delay: i * 0.05,
                duration: 0.6,
                repeat: Infinity,
                repeatDelay: 1
            }
        })
    };

    const popVariant = {
        pop: (isMatch: boolean) => ({
            scale: [1, 1.5, 1],
            // Removed color animation to prevent overriding text-inherit with white (issue in Light Mode)
            // Rely on textShadow and scale for the effect
            textShadow: isMatch
                ? ['0px 0px 0px rgba(0,0,0,0)', '0px 0px 8px rgba(251, 191, 36, 0.8)', '0px 0px 0px rgba(0,0,0,0)']
                : 'none',
            transition: { duration: 0.4, ease: "easeOut" }
        })
    };

    const floatVariant = {
        float: (i: number) => {
            const seed = i * 1337;
            const sign = i % 2 === 0 ? 1 : -1;
            const angleMagnitude = 5 + (seed % 20);
            const randomRotation = sign * angleMagnitude;

            return {
                y: [0, -4, 0],
                rotate: randomRotation,
                transition: {
                    y: {
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.2
                    },
                    rotate: { duration: 0 }
                }
            };
        }
    };

    if (scrambleItems) {
        return (
            <motion.span layout className={`${className} breaking-words flex gap-1`}>
                {showColons && <span className="mr-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>}
                {scrambleItems.map((item, i) => {
                    const shouldFloat = item.isReal && !visible;

                    return (
                        <motion.span
                            layout
                            key={item.id}
                            custom={i}
                            variants={floatVariant as any}
                            animate={shouldFloat ? "float" : undefined}
                            className={`inline-block ${item.isSpace ? 'whitespace-pre' : ''} ${item.isReal
                                ? 'font-bold text-inherit mx-0.5 drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]'
                                : 'font-mono text-gray-400 dark:text-gray-500 font-medium'
                                }`}
                            transition={{
                                layout: {
                                    duration: 0.4,
                                    ease: "easeInOut"
                                }
                            }}
                        >
                            {item.char}
                        </motion.span>
                    )
                })}
                {showColons && <span className="ml-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>}
            </motion.span>
        );
    }

    // Normal / Fallback Render
    return (
        <motion.span layout className={`${className} breaking-words flex`}>
            {showColons && <span className="mr-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>}
            {display.split('').map((char, i) => {
                const isPositionalMatch = char === text[i];
                // For Hint 2: Real letters are those that ARE NOT special cipher chars
                const isSpecial = SPECIAL_CHARS.has(char);
                // "Real" in the context of Hint 2 means "Exposed Letter" (not a special cipher char)
                // We rely on the fact that generaetCipherString puts special chars in non-exposed slots.
                // But we also check if it exists in text to be safe/consistent with old logic?
                // Actually, if a normal letter is used as a cipher filler (Level 0/1), we don't want to highlight it as "Real" unless position matches.
                // But for Level 2 (Hint 2), we know special chars are the cipher.

                const isScrambleMatch = hintLevel >= 2 && !isSpecial && char !== ' ';
                const isEffectiveMatch = isPositionalMatch || isScrambleMatch;
                const isJustRevealed = changedIndices.has(i);

                // Determine Animation
                let animateState = undefined;
                let variantToUse = undefined;

                if (isJustRevealed) {
                    animateState = "pop";
                    variantToUse = popVariant;
                } else if (hintLevel >= 2 && isEffectiveMatch && !visible) {
                    animateState = "float";
                    variantToUse = floatVariant;
                } else if (isSolving) {
                    animateState = "bounce";
                    variantToUse = bounceVariant;
                }

                if (visible) {
                    return (
                        <span key={i} className={isPositionalMatch ? '' : 'text-green-500 opacity-70'}>
                            {char}
                        </span>
                    );
                }

                return (
                    <motion.span
                        layout
                        key={`${i}-${char}`}
                        custom={isEffectiveMatch ? i : isEffectiveMatch}
                        animate={animateState}
                        variants={variantToUse as any}
                        className={`inline-block ${isEffectiveMatch
                            ? `font-bold text-inherit drop-shadow-[0_0_2px_rgba(255,255,255,0.5)] ${(hintLevel >= 2 && !visible) ? 'mx-0.5' : ''}`
                            : 'font-mono text-gray-400 dark:text-gray-500 font-medium'
                            }`}
                    >
                        {char}
                    </motion.span>
                );
            })}
            {showColons && <span className="ml-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>}
        </motion.span>
    );
}

// Fixed Shuffler for array logic
function generateShuffledView(baseItems: ScrambleItem[]): ScrambleItem[] {
    const result = new Array(baseItems.length);
    const movers: ScrambleItem[] = [];

    // 1. Separate spaces and movers
    baseItems.forEach((item, idx) => {
        if (item.isSpace) {
            result[idx] = item;
        } else {
            movers.push(item);
        }
    });

    // 2. Shuffle movers
    for (let i = movers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [movers[i], movers[j]] = [movers[j], movers[i]];
    }

    // 3. Fill back into empty slots
    let mIdx = 0;
    for (let i = 0; i < result.length; i++) {
        if (!result[i]) {
            result[i] = movers[mIdx++];
        }
    }

    return result;
}
