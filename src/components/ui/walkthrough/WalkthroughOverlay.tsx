'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

type WalkthroughOverlayProps = {
    targetId: string;
    onClickOutside?: () => void;
};

export function WalkthroughOverlay({ targetId, onClickOutside }: WalkthroughOverlayProps) {
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    // Update target rect on mount and resize
    useEffect(() => {
        const updateRect = () => {
            const el = document.getElementById(targetId);
            if (el) {
                const rect = el.getBoundingClientRect();
                setTargetRect(rect);
            }
        };

        updateRect();
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, true); // true for capture phase to catch all scrolls

        // Polling fallback in case of dynamic content changes
        const interval = setInterval(updateRect, 500);

        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, true);
            clearInterval(interval);
        };
    }, [targetId]);


    // SVG path to create a cutout
    // We draw a huge rectangle covering the screen, then a smaller one ("cutout") counter-clockwise
    const getPath = (rect: DOMRect) => {
        // Full screen cover
        const w = window.innerWidth;
        const h = window.innerHeight;
        const padding = 8; // Breathing room for local highlight

        // Target coordinates with padding
        const tx = rect.left - padding;
        const ty = rect.top - padding;
        const tw = rect.width + (padding * 2);
        const th = rect.height + (padding * 2);

        // Path constraint to viewport
        const safetx = Math.max(0, tx);
        const safety = Math.max(0, ty);
        const safetw = Math.min(w - safetx, tw);
        const safeth = Math.min(h - safety, th);

        return `M0,0 h${w} v${h} h-${w} z M${safetx},${safety} v${safeth} h${safetw} v-${safeth} z`;
    };

    if (!targetRect) {
        return (
            <div className="fixed inset-0 z-50 bg-black/70 pointer-events-auto transition-all duration-300 ease-in-out" onClick={onClickOutside} />
        );
    }

    return (
        <div className="fixed inset-0 z-50 pointer-events-none">
            {/* The SVG Mask Layer */}
            <svg width="100%" height="100%" className="absolute inset-0 transition-all duration-300 ease-in-out pointer-events-auto">
                <motion.path
                    initial={{ d: getPath(targetRect) }}
                    animate={{ d: getPath(targetRect) }}
                    transition={{
                        type: "spring",
                        stiffness: 150,
                        damping: 25,
                        mass: 0.5
                    }}
                    fill="rgba(0, 0, 0, 0.7)"
                    fillRule="evenodd"
                    onClick={onClickOutside}
                />
            </svg>

            {/* Optional: Highlight Border */}
            <motion.div
                className="absolute border-2 border-white rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.3)] pointer-events-none"
                initial={{
                    top: targetRect.top - 8,
                    left: targetRect.left - 8,
                    width: targetRect.width + 16,
                    height: targetRect.height + 16
                }}
                animate={{
                    top: targetRect.top - 8,
                    left: targetRect.left - 8,
                    width: targetRect.width + 16,
                    height: targetRect.height + 16
                }}
                transition={{
                    type: "spring",
                    stiffness: 150,
                    damping: 25,
                    mass: 0.5
                }}
            />
        </div>
    );
}
