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
}

export function CipherText({ text, cipherText, visible, className = '', isSolving = false }: CipherTextProps) {
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
                setTimeout(() => setChangedIndices(new Set()), 1000);
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
            transition: { duration: 0.4, ease: "easeOut" as const }
        })
    };

    return (
        <span className={`${className} breaking-words`}>
            {showColons && <span className="mr-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>}
            {display.split('').map((char, i) => {
                const isMatch = char === text[i];
                const isJustRevealed = changedIndices.has(i);

                if (visible) {
                    return (
                        <span key={i} className={isMatch ? '' : 'text-green-500 opacity-70'}>
                            {char}
                        </span>
                    );
                }

                // In Cipher Mode (Hinting)
                return (
                    <motion.span
                        key={`${i}-${char}`}
                        custom={isMatch} // Pass isMatch to variant
                        variants={isJustRevealed ? popVariant : (isSolving ? bounceVariant : undefined)}
                        animate={isJustRevealed ? "pop" : (isSolving ? "bounce" : undefined)}
                        className={`inline-block ${isMatch
                            ? 'font-bold text-inherit drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]'
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
