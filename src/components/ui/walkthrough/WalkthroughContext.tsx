'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { WalkthroughOverlay } from './WalkthroughOverlay';
import { WalkthroughPopover } from './WalkthroughPopover';

export type WalkthroughStep = {
    id: string;
    targetId: string; // The DOM ID of the element to highlight
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    onNext?: () => void;
    onPrev?: () => void;
};

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

export type WalkthroughOptions = {
    onSkip?: () => void;
    onComplete?: () => void;
};

const WalkthroughContext = createContext<WalkthroughContextType | undefined>(undefined);

export function WalkthroughProvider({ children }: { children: React.ReactNode }) {
    const [steps, setSteps] = useState<WalkthroughStep[]>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<WalkthroughOptions>({});

    const startTour = useCallback((newSteps: WalkthroughStep[], newOptions?: WalkthroughOptions) => {
        if (newSteps.length === 0) return;
        setSteps(newSteps);
        if (newOptions) setOptions(newOptions);
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
        if (currentStepIndex < steps.length - 1) {
            steps[currentStepIndex].onNext?.();
            setCurrentStepIndex(prev => prev + 1);
        } else {
            // Finished
            steps[currentStepIndex].onNext?.(); // Call onNext of last step too if exists
            endTour(true);
        }
    }, [currentStepIndex, steps, endTour]);

    const prevStep = useCallback(() => {
        if (currentStepIndex > 0) {
            steps[currentStepIndex].onPrev?.();
            setCurrentStepIndex(prev => prev - 1);
        }
    }, [currentStepIndex, steps]);

    const currentStep = isOpen && steps[currentStepIndex] ? steps[currentStepIndex] : null;

    // Handle Escape Key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') {
                endTour(false);
            }
            // ... keys ...
            if (isOpen && e.key === 'ArrowRight') {
                nextStep();
            }
            if (isOpen && e.key === 'ArrowLeft') {
                prevStep();
            }
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
            currentStep
        }}>
            {children}
            <AnimatePresence>
                {isOpen && currentStep && (
                    <>
                        <WalkthroughOverlay targetId={currentStep.targetId} onClickOutside={() => endTour(false)} />
                        <WalkthroughPopover
                            step={currentStep}
                            current={currentStepIndex}
                            total={steps.length}
                            onNext={nextStep}
                            onPrev={prevStep}
                            onSkip={() => endTour(false)}
                        />
                    </>
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
