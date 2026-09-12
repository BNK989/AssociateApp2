'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { WalkthroughOverlay } from './WalkthroughOverlay';
import { WalkthroughPopover } from './WalkthroughPopover';
import { scrollTargetIntoView, useTargetRect } from './useTargetRect';
import type { WalkthroughOptions, WalkthroughStep } from './types';

type WalkthroughContextType = {
    startTour: (steps: WalkthroughStep[], options?: WalkthroughOptions) => void;
    endTour: (completed?: boolean) => void;
    nextStep: () => void;
    prevStep: () => void;
    currentStepIndex: number;
    totalSteps: number;
    isOpen: boolean;
    currentStep: WalkthroughStep | null;
};

const WalkthroughContext = createContext<WalkthroughContextType | undefined>(undefined);

/**
 * The tour, rendered once above the whole app.
 *
 * The scrim and the card are separate elements sharing one measurement of the
 * step's target (`useTargetRect`), so they cannot disagree about where it is.
 */
export function WalkthroughProvider({ children }: { children: React.ReactNode }) {
    const [steps, setSteps] = useState<WalkthroughStep[]>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<WalkthroughOptions>({});

    const currentStep = isOpen && steps[currentStepIndex] ? steps[currentStepIndex] : null;
    const targetRect = useTargetRect(currentStep?.targetId ?? '');

    const startTour = useCallback((newSteps: WalkthroughStep[], newOptions?: WalkthroughOptions) => {
        if (newSteps.length === 0) return;
        setSteps(newSteps);
        setOptions(newOptions ?? {});
        setCurrentStepIndex(0);
        setIsOpen(true);
    }, []);

    const endTour = useCallback((completed = false) => {
        setIsOpen(false);
        setSteps([]);
        setCurrentStepIndex(0);

        if (completed) {
            options.onComplete?.();
        } else {
            options.onSkip?.();
        }
        setOptions({});
    }, [options]);

    const nextStep = useCallback(() => {
        steps[currentStepIndex]?.onNext?.();

        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex((prev) => prev + 1);
        } else {
            endTour(true);
        }
    }, [currentStepIndex, steps, endTour]);

    const prevStep = useCallback(() => {
        if (currentStepIndex === 0) return;
        steps[currentStepIndex]?.onPrev?.();
        setCurrentStepIndex((prev) => prev - 1);
    }, [currentStepIndex, steps]);

    // Bring each step's subject on screen before it is pointed at.
    useEffect(() => {
        if (currentStep) scrollTargetIntoView(currentStep.targetId);
    }, [currentStep]);

    /**
     * Keyboard control.
     *
     * The arrows follow the *reading* direction rather than the screen: in
     * Hebrew and Arabic the tour runs right to left, so ArrowLeft advances it.
     * Mapping them physically meant the back button and the back key pointed
     * opposite ways for half the app's locales.
     */
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const rtl = document.documentElement.dir === 'rtl';

            if (e.key === 'Escape') {
                endTour(false);
                return;
            }

            const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
            const backward = rtl ? 'ArrowRight' : 'ArrowLeft';

            if (e.key === forward) nextStep();
            if (e.key === backward) prevStep();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, nextStep, prevStep, endTour]);

    return (
        <WalkthroughContext.Provider value={{
            startTour,
            endTour,
            nextStep,
            prevStep,
            currentStepIndex,
            totalSteps: steps.length,
            isOpen,
            currentStep,
        }}>
            {children}

            <AnimatePresence>
                {currentStep && (
                    <React.Fragment key="walkthrough">
                        <WalkthroughOverlay rect={targetRect} onClickOutside={() => endTour(false)} />
                        <WalkthroughPopover
                            key={currentStep.id}
                            step={currentStep}
                            targetRect={targetRect}
                            finishLabel={options.finishLabel}
                            current={currentStepIndex}
                            total={steps.length}
                            onNext={nextStep}
                            onPrev={prevStep}
                            onSkip={() => endTour(false)}
                        />
                    </React.Fragment>
                )}
            </AnimatePresence>
        </WalkthroughContext.Provider>
    );
}

export const useWalkthrough = () => {
    const context = useContext(WalkthroughContext);
    if (!context) {
        throw new Error('useWalkthrough must be used within a WalkthroughProvider');
    }
    return context;
};
