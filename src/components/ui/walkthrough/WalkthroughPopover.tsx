'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { WalkthroughStep } from './WalkthroughContext';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

type WalkthroughPopoverProps = {
    step: WalkthroughStep;
    current: number;
    total: number;
    onNext: () => void;
    onPrev: () => void;
    onSkip: () => void;
};

export function WalkthroughPopover({ step, current, total, onNext, onPrev, onSkip }: WalkthroughPopoverProps) {
    const t = useTranslations('Walkthrough'); // Assuming generic 'Walkthrough' namespace, or we can use common keys
    const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({});

    // Calculate position relative to target
    useEffect(() => {
        const updatePosition = () => {
            const el = document.getElementById(step.targetId);
            const pos = step.position || 'bottom';

            // Center if explicitly requested OR if target not found/empty
            if (pos === 'center' || !el) {
                setPositionStyle({
                    top: '50%',
                    left: '50%',
                    position: 'fixed'
                });
                return;
            }

            const rect = el.getBoundingClientRect();
            const padding = 16;
            const popoverWidth = 320; // Max width assumption

            let top = 0;
            let left = 0;

            if (pos === 'bottom') {
                top = rect.bottom + padding;
                left = rect.left + (rect.width / 2) - (popoverWidth / 2);
            } else if (pos === 'top') {
                top = rect.top - padding - 200; // rough height guess
                left = rect.left + (rect.width / 2) - (popoverWidth / 2);
            }

            // Viewport bounds check
            if (left < 10) left = 10;
            if (left + popoverWidth > window.innerWidth - 10) left = window.innerWidth - popoverWidth - 10;
            if (top < 10) top = 10;

            setPositionStyle({
                top,
                left,
                position: 'fixed',
                transform: 'none'
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [step.targetId, step.position]);

    const isLast = current === total - 1;

    const isCentered = step.position === 'center' || !step.targetId;

    return (
        <motion.div
            initial={isCentered ? { opacity: 0, x: "-50%", y: "-45%", scale: 0.95 } : { opacity: 0, x: 0, y: 10, scale: 0.95 }}
            animate={isCentered ? { opacity: 1, x: "-50%", y: "-50%", scale: 1 } : { opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={isCentered ? { opacity: 0, x: "-50%", y: "-45%", scale: 0.95 } : { opacity: 0, x: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="z-[60] fixed w-[320px] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 p-5 flex flex-col gap-3"
            style={positionStyle}
        >
            <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-1 min-w-0 pr-4">
                    <span className="flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 text-xs shadow-sm">
                        {current + 1}
                    </span>
                    <span className="truncate">{step.title}</span>
                </h3>
                <button onClick={onSkip} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {step.content}
            </p>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-400 font-medium">
                    {current + 1} / {total}
                </span>

                <div className="flex gap-2">
                    {current > 0 && (
                        <Button variant="ghost" size="sm" onClick={onPrev} className="h-8 px-2 text-gray-500">
                            {t('back') || 'Back'}
                        </Button>
                    )}
                    <Button
                        size="sm"
                        onClick={onNext}
                        className="h-8 bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20"
                    >
                        {isLast ? (t('finish') || 'Finish') : (t('next') || 'Next')}
                        {!isLast && <ChevronRight className="w-3 h-3 ml-1 rtl:rotate-180" />}
                    </Button>
                </div>
            </div>

            {/* Arrow Pointer (Visual only, approximate) */}
            {step.position !== 'center' && (
                <div
                    className={`absolute w-3 h-3 bg-white dark:bg-gray-900 border-l border-t border-gray-200 dark:border-gray-800 transform rotate-45 
                        ${step.position === 'top' ? '-bottom-1.5 left-1/2 -translate-x-1/2 border-l-0 border-t-0 border-r border-b' : '-top-1.5 left-1/2 -translate-x-1/2'}
                    `}
                />
            )}
        </motion.div>
    );
}
