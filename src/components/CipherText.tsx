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
    guesses?: string[];
}

interface ScrambleItem {
    char: string;
    id: string; // Stable ID for layout animations
    isSpace: boolean;
    isReal: boolean; // Tracking if it's a real char (Sans) or filler (Mono) during scramble
    locked?: boolean; // If true, this item MUST NOT move (Green letter)
}

export function CipherText({ text, cipherText, visible, className = '', isSolving = false, hintLevel = 0, forceScramble, guesses = [] }: CipherTextProps) {
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

    // Calculate Wordle States
    // Green: Correct char at correct index
    // Orange: Correct char somewhere in the text, but not at this index (and not fully consumed by greens)
    // Note: Simple version for game - if you guessed a letter and it is in the target, show it orange everywhere it appears (unless green).

    const greenIndices = new Set<number>();
    const revealedChars = new Set<string>();

    if (!visible) {
        guesses.forEach(guess => {
            const cleanGuess = guess.toLowerCase();
            const cleanText = text.toLowerCase();

            // 1. Check Greens and Reveals
            for (let i = 0; i < Math.min(cleanGuess.length, cleanText.length); i++) {
                if (cleanGuess[i] === cleanText[i]) {
                    greenIndices.add(i);
                }
                // Track all guessed chars
                if (cleanText[i] && cleanText.includes(cleanGuess[i])) { // Added check
                    revealedChars.add(cleanGuess[i]);
                }
            }
        });
    }

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

                // Create stable items from the TARGET string (the Anagram/Cipher mixed)
                const baseItems: ScrambleItem[] = target.split('').map((c, i) => {
                    const isGreen = greenIndices.has(i);
                    const isOrange = !isGreen && revealedChars.has(text[i].toLowerCase());

                    const realChar = text[i];
                    const cipherChar = (cipherText || cipherRef.current)[i];

                    let charToShow = cipherChar;
                    let isReal = false;
                    let locked = false;

                    const SPECIAL_CHARS_ARRAY = Array.from(SPECIAL_CHARS);

                    if (isGreen) {
                        charToShow = realChar;
                        isReal = true;
                        locked = true;
                    } else if (isOrange) {
                        charToShow = realChar;
                        isReal = true; // Orange letters participate in "Real" styling
                    } else if (hintLevel >= 2) {
                        const shouldReveal = Math.random() < 0.7;
                        if (shouldReveal) {
                            charToShow = realChar;
                            isReal = true;
                        } else {
                            // Hidden: Force Special Char
                            if (!SPECIAL_CHARS.has(cipherChar)) {
                                charToShow = SPECIAL_CHARS_ARRAY[Math.floor(Math.random() * SPECIAL_CHARS_ARRAY.length)];
                            } else {
                                charToShow = cipherChar;
                            }
                            isReal = false;
                        }
                    } else {
                        // Level 0/1: Standard Cipher
                        const isCipherSpecial = SPECIAL_CHARS.has(cipherChar);
                        charToShow = cipherChar;
                        isReal = !isCipherSpecial && text.toLowerCase().includes(cipherChar.toLowerCase());
                    }

                    return {
                        char: charToShow,
                        id: `${i}-${charToShow}`, // Stable-ish ID
                        isSpace: realChar === ' ',
                        isReal,
                        locked: locked || realChar === ' ' // Spaces always locked effectively
                    };
                });

                // Hint 1 Fix: Ensure the FIRST letter is actually the correct one before we start shuffling
                if (hintLevel >= 1 && baseItems.length > 0) {
                    // Force lock first char
                    baseItems[0].locked = true;
                    baseItems[0].isReal = true;
                    baseItems[0].char = text[0]; // Ensure it's real char
                }

                // Initial shuffle
                const shuffledStart = generateShuffledView(baseItems);
                setScrambleItems(shuffledStart);

                for (let i = 0; i < shuffles; i++) {
                    if (isCancelled) return;
                    await new Promise(r => setTimeout(r, interval));

                    if (i === shuffles - 1) {
                        // Final step: settle to A RANDOM configuration
                        const finalShuffle = generateShuffledView(baseItems);
                        setScrambleItems(finalShuffle);
                    } else {
                        // Shuffle again
                        setScrambleItems(prev => prev ? generateShuffledView(prev) : baseItems);
                    }
                }

                await new Promise(r => setTimeout(r, 500));

                if (!isCancelled) {
                    if (!visible && hintLevel >= 2) {
                        // Keep scramble view
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
    }, [visible, text, cipherText, hintLevel, forceScramble, guesses]); // Added guesses dependency

    // Track changes
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
            <motion.span className={`${className} break-words inline-flex flex-wrap gap-1`}>
                {showColons && <span className="mr-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>}
                {scrambleItems.map((item, i) => {
                    const shouldFloat = item.isReal && !visible;
                    const isFirst = i === 0;

                    const isGreen = item.locked && item.isReal;
                    const isOrange = !item.locked && item.isReal; // It's moving, but it's a real char.

                    let colorClass = 'text-inherit';
                    if (isGreen) colorClass = 'text-green-600 dark:text-green-400';
                    else if (isOrange) colorClass = 'text-orange-500 dark:text-orange-400';
                    else colorClass = 'text-gray-400 dark:text-gray-500';

                    return (
                        <motion.span
                            layout
                            key={item.id}
                            custom={i}
                            variants={floatVariant as any}
                            animate={shouldFloat ? "float" : undefined}
                            className={`inline-block ${item.isSpace ? 'whitespace-pre' : ''} ${item.isReal
                                ? `font-bold mx-0.5 drop-shadow-[0_0_2px_rgba(255,255,255,0.5)] ${colorClass}`
                                : 'font-mono text-gray-400 dark:text-gray-500 font-medium'
                                } ${isFirst && hintLevel >= 1 ? 'uppercase' : ''}`}
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

    return (
        <motion.span className={`${className} break-words inline-flex flex-wrap ${(visible || hintLevel >= 1 || isSolving) ? '[&>span:first-child]:uppercase' : ''} ${isSolving ? 'gap-1' : ''}`}>
            {showColons && <span className="mr-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>}
            {display.split('').map((char, i) => {
                const isPositionalMatch = char === text[i];
                const isSpecial = SPECIAL_CHARS.has(char);

                const isGreen = greenIndices.has(i);

                let renderChar = char;
                let isEffectiveMatch = isPositionalMatch;
                let colorClass = '';

                if (!visible) {
                    if (isGreen && text[i]) {
                        renderChar = text[i];
                        isEffectiveMatch = true;
                        colorClass = 'text-green-600 dark:text-green-400';
                    } else if (text[i] && revealedChars.has(text[i].toLowerCase())) {
                        // Orange
                        renderChar = text[i];
                        isEffectiveMatch = true;
                        colorClass = 'text-orange-500 dark:text-orange-400';
                    } else {
                        // Standard Cipher Logic
                        const isScrambleMatch = hintLevel >= 2 && !isSpecial && char !== ' ';
                        if (isScrambleMatch) isEffectiveMatch = true;
                        if (!isEffectiveMatch) colorClass = 'text-gray-400 dark:text-gray-500 font-medium font-mono';
                    }
                }

                if (visible) {
                    return (
                        <span key={i} className={isPositionalMatch ? '' : 'text-green-500 opacity-70'}>
                            {char}
                        </span>
                    );
                }

                const isJustRevealed = changedIndices.has(i);

                return (
                    <motion.span
                        layout
                        key={`${i}-${renderChar}`}
                        custom={isEffectiveMatch ? i : isEffectiveMatch}
                        animate={isJustRevealed ? "pop" : (hintLevel >= 2 && isEffectiveMatch && !visible) ? "float" : undefined}
                        variants={isJustRevealed ? popVariant : floatVariant as any}
                        className={`inline-block ${isEffectiveMatch
                            ? `font-bold drop-shadow-[0_0_2px_rgba(255,255,255,0.5)] ${colorClass || 'text-inherit'} ${(hintLevel >= 2 && !visible) ? 'mx-0.5' : ''}`
                            : `${colorClass}`
                            }`}
                    >
                        {renderChar}
                    </motion.span>
                );
            })}
            {showColons && <span className="ml-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>}
        </motion.span>
    );
}

// Fixed Shuffler for array logic
function generateShuffledView(baseItems: ScrambleItem[], preserveFirst: boolean = false): ScrambleItem[] {
    const result = new Array(baseItems.length);
    const movers: ScrambleItem[] = [];

    // 1. Separate locked and movers
    baseItems.forEach((item, idx) => {
        if (item.locked || (preserveFirst && idx === 0)) {
            result[idx] = item;
            return;
        }

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
