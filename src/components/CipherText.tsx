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
            const target = visible ? text : cipherRef.current;
            const start = display;

            // If already at target, skip
            if (display === target) return;

            const steps = text.length;
            const delay = Math.max(30, Math.min(100, 1000 / steps));

            for (let i = 0; i <= steps; i++) {
                if (isCancelled) return;

                // Simple interpolation logic for "Reveal"
                if (visible) {
                    setDisplay(text.slice(0, i) + cipherRef.current.slice(i));
                } else {
                    // Fallback: just set to target if not revealing logic
                    setDisplay(target);
                    break;
                }

                await new Promise(r => setTimeout(r, delay));
            }
        };

        animate();
        return () => { isCancelled = true; };
    }, [visible, text, cipherText]);

    // Render logic
    const showColons = !visible && !cipherText;
    const COLON = '\u2237';

    // Animation variants for bouncing
    const bounceVariant = {
        bounce: (i: number) => ({
            y: [0, -3, 0],
            transition: {
                delay: i * 0.05, // Stagger effect
                duration: 0.6,
                repeat: Infinity,
                repeatDelay: 1 // Pause between waves
            }
        })
    };

    return (
        <span className={`${className} breaking-words`}>
            {showColons && <span className="mr-0.5 tracking-tighter opacity-75 select-none">{COLON}</span>}
            {display.split('').map((char, i) => {
                const isMatch = char === text[i];
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
                        key={i}
                        custom={i % 5} // Limit stagger index to avoid massive delays on long msgs
                        variants={isSolving ? bounceVariant : undefined}
                        animate={isSolving ? "bounce" : undefined}
                        className={`inline-block ${isMatch
                            ? 'font-bold text-inherit drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]'
                            : 'font-mono opacity-75' // Inherit color (White/Black) but dim it.
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
