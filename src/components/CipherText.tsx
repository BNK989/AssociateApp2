'use client';
import { useEffect, useState, useRef } from 'react';

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

interface CipherTextProps {
    text: string;
    visible: boolean;
    className?: string;
}

export function CipherText({ text, visible, className = '' }: CipherTextProps) {
    const cipherRef = useRef<string>('');

    // Initialize cipher string lazily
    if (!cipherRef.current) {
        cipherRef.current = text.split('').map(() => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
    }

    const [display, setDisplay] = useState(visible ? text : cipherRef.current);
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        let isCancelled = false;
        const animate = async () => {
            const target = visible ? text : cipherRef.current;
            const start = display;

            // Determine direction
            // If visible=true, we go Cipher -> Text
            // If visible=false, we go Text -> Cipher

            const steps = text.length;
            const delay = Math.max(30, Math.min(100, 1000 / steps)); // Adjust speed based on length

            for (let i = 0; i <= steps; i++) {
                if (isCancelled) return;

                if (visible) {
                    // Reveal: i chars from text, rest from cipher
                    setDisplay(text.slice(0, i) + cipherRef.current.slice(i));
                } else {
                    // Scramble: i chars from cipher, rest from text
                    setDisplay(cipherRef.current.slice(0, i) + text.slice(i));
                }

                await new Promise(r => setTimeout(r, delay));
            }
        };

        animate();
        return () => { isCancelled = true; };
    }, [visible, text]);

    // Render logic
    if (visible) {
        // If fully revealed
        if (display === text) {
            return <span className={`text-white ${className}`}>{display}</span>;
        }
        // Animating Reveal (Green Matrix style?)
        return <span className={`text-green-400 font-mono ${className}`}>::{display}::</span>;
    } else {
        // Ciphered
        return <span className={`text-gray-300 font-mono tracking-widest ${className}`}>::{display}::</span>;
    }
}
