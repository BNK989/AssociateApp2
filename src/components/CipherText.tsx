'use client';
import { useEffect, useState, useRef } from 'react';
import { motion } from "framer-motion";


const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

interface CipherTextProps {
    text: string;
    cipherText?: string;
    visible: boolean;
    className?: string;
    isSolving?: boolean;
    hintLevel?: number;
}

export function CipherText({ text, cipherText, visible, className = '', isSolving = false, hintLevel = 0 }: CipherTextProps) {
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
    const isFirstRender = useRef(true);

    useEffect(() => {
        // Update local cipher ref if prop changes (e.g. new hint bought)
        if (cipherText) {
            cipherRef.current = cipherText;
            if (!visible) {
                setDisplay(cipherText);
            }
        }
    }, [cipherText, visible]);

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

            // If already at target, skip
            if (display === target) return;

            // PRE-ANIMATION: Scramble Effect for Hint Level 2 (transitions to scrambled state)
            // We want to show "chaos" before settling on the scrambled letters
            if (!visible && hintLevel >= 2) {
                const duration = 600;
                const frameRate = 50;
                const frames = duration / frameRate;

                for (let f = 0; f < frames; f++) {
                    if (isCancelled) return;
                    // Generate completely random string of target length to simulate "shuffling"
                    // We preserve spaces to keep word structure
                    const randomStr = target.split('').map((c, idx) => {
                        if (c === ' ') return ' ';
                        // Occasionally show the real char from target to hint at it settling
                        if (Math.random() > 0.7) return target[idx];
                        return CHARS[Math.floor(Math.random() * CHARS.length)];
                    }).join('');

                    setDisplay(randomStr);
                    await new Promise(r => setTimeout(r, frameRate));
                }
                // After scramble, we are "done" with the chaotic part. 
                // We can either let the wipe finish it or just set it. 
                // Let's set it to target immediately to snap to the anagram.
                setDisplay(target);
                return;
            }

            const steps = Math.max(text.length, cipherRef.current.length);
            const delay = Math.max(30, Math.min(100, 1000 / steps));

            for (let i = 0; i <= steps; i++) {
                if (isCancelled) return;

                if (visible) {
                    setDisplay(text.slice(0, i) + cipherRef.current.slice(i));
                } else {
                    // Morph logic for Hint updates (visible=false)
                    // Blend start and target
                    const targetPart = target.slice(0, i);
                    const startPart = start.slice(i);
                    setDisplay(targetPart + startPart);
                }

                await new Promise(r => setTimeout(r, delay));
            }
            if (!isCancelled) setDisplay(target);
        };

        animate();
        return () => { isCancelled = true; };
    }, [visible, text, cipherText]);

    // Track previous cipher to detect changes (Hint Reveals)
    const prevCipherRef = useRef(cipherText || '');
    const [changedIndices, setChangedIndices] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (visible) return; // Don't animate hints if fully visible

        const currentCipher = cipherText || '';
        const prevCipher = prevCipherRef.current;

        if (currentCipher !== prevCipher) {
            const newChanged = new Set<number>();
            // Detect which indices changed to match real text
            // Note: If lengths different, alignment might be tricky, but usually hints preserve index alignment relative to NEW string
            // Simplest heuristic: if char at index i is now correct and wasn't before (or just changed)
            const len = Math.max(currentCipher.length, prevCipher.length);
            for (let i = 0; i < len; i++) {
                const charNow = currentCipher[i] || '';
                const charPrev = prevCipher[i] || '';

                // If char changed AND it now matches the real text (meaning it was revealed)
                // (Or just changed is enough for a "pop" effect, but revealed is better)
                if (charNow !== charPrev && charNow === text[i]) {
                    newChanged.add(i);
                }
            }

            if (newChanged.size > 0) {
                setChangedIndices(newChanged);
                // Clear highlight after animation
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
            color: isMatch
                ? ['#ffffff', '#fbbf24', '#ffffff'] // Gold for match
                : ['#ffffff', '#a8a29e', '#ffffff'], // Grayish flash for non-match
            textShadow: isMatch
                ? ['0px 0px 0px rgba(0,0,0,0)', '0px 0px 8px rgba(251, 191, 36, 0.8)', '0px 0px 0px rgba(0,0,0,0)']
                : 'none',
            transition: { duration: 0.4, ease: "easeOut" as const },
            transitionEnd: {
                color: "inherit",
                textShadow: "none",
                scale: 1
            }
        })
    };

    const floatVariant = {
        float: (i: number) => {
            // Deterministic random based on index/char for stable SSR/render
            // Alternating directions and varied angles (-25 to -5, 5 to 25)
            const seed = i * 1337;
            const sign = i % 2 === 0 ? 1 : -1;
            const angleMagnitude = 5 + (seed % 20); // 5 to 24 degrees
            const randomRotation = sign * angleMagnitude;

            return {
                y: [0, -4, 0], // Reduced movement slightly
                rotate: randomRotation,
                transition: {
                    y: {
                        duration: 3, // Slower (was 2)
                        repeat: Infinity,
                        ease: "easeInOut" as const,
                        delay: i * 0.2 // More staggered
                    },
                    rotate: {
                        duration: 0 // Static rotation
                    }
                }
            };
        }
    };

    return (
        <span className={`${className} breaking-words`}>
            {showColons && <span className="mr-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>}
            {display.split('').map((char, i) => {
                const isPositionalMatch = char === text[i];
                // For Level 2+ Scramble, we use inclusion matching (anagram style)
                // We ensure it's not a filler char by checking if text includes it.
                // Note: simple inclusion check might highlight random lucky fillers, but acceptable for now.
                const isScrambleMatch = hintLevel >= 2 && text.toLowerCase().includes(char.toLowerCase()) && char !== ' ';

                const isEffectiveMatch = isPositionalMatch || isScrambleMatch;
                const isJustRevealed = changedIndices.has(i);

                if (visible) {
                    return (
                        <span key={i} className={isPositionalMatch ? '' : 'text-green-500 opacity-70'}>
                            {char}
                        </span>
                    );
                }

                // In Cipher Mode (Hinting)
                return (
                    <motion.span
                        key={`${i}-${char}`}
                        custom={isEffectiveMatch ? i : isEffectiveMatch} // Pass index for float, bool for others
                        variants={isJustRevealed ? popVariant : ((hintLevel >= 2 && isEffectiveMatch && !visible) ? floatVariant : (isSolving ? bounceVariant : undefined))}
                        animate={isJustRevealed ? "pop" : ((hintLevel >= 2 && isEffectiveMatch && !visible) ? "float" : (isSolving ? "bounce" : undefined))}
                        className={`inline-block ${isEffectiveMatch
                            ? `font-bold text-inherit drop-shadow-[0_0_2px_rgba(255,255,255,0.5)] ${(hintLevel >= 2 && !visible) ? 'mx-0.5' : ''}` // Added margin for floating mode
                            : 'font-mono opacity-75'
                            }`}
                    >
                        {char}
                    </motion.span>
                );
            })}
            {showColons && <span className="ml-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>}


        </span>
    );
}
