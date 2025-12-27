import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare, Zap, Trophy, ArrowRight, Check } from 'lucide-react';
import { cn } from "@/lib/utils";

type OnboardingTutorialProps = {
    open: boolean;
    onComplete: () => void;
};

export function OnboardingTutorial({ open, onComplete }: OnboardingTutorialProps) {
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: "Welcome to Associate!",
            description: "The game where great minds think alike. Test your connection with friends in this word association game.",
            icon: <Zap className="w-12 h-12 text-yellow-500" />,
            color: "bg-yellow-50 dark:bg-yellow-900/20",
        },
        {
            title: "Phase 1: Chatting",
            description: "Start by texting naturally with your friends. The goal is to build up a conversation context.",
            icon: <MessageSquare className="w-12 h-12 text-blue-500" />,
            color: "bg-blue-50 dark:bg-blue-900/20",
        },
        {
            title: "Phase 2: Solving",
            description: "Guess the previous word! Hints are available if you get stuck, but be careful - too many wrong guesses will reveal the word.",
            icon: <Zap className="w-12 h-12 text-purple-500" />,
            color: "bg-purple-50 dark:bg-purple-900/20",
        },
        {
            title: "Ready to Play?",
            description: "Create a new game and invite your friends to get started!",
            icon: <Trophy className="w-12 h-12 text-green-500" />,
            color: "bg-green-50 dark:bg-green-900/20",
        }
    ];

    const currentStep = steps[step];
    const isLastStep = step === steps.length - 1;

    const handleNext = () => {
        if (isLastStep) {
            onComplete();
        } else {
            setStep(prev => prev + 1);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onComplete()}>
            <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <DialogHeader>
                    <div className="flex justify-center mb-6">
                        <div className={cn("p-6 rounded-full flex items-center justify-center transition-colors duration-300", currentStep.color)}>
                            {currentStep.icon}
                        </div>
                    </div>
                    <DialogTitle className="text-center text-2xl font-bold mb-2">
                        {currentStep.title}
                    </DialogTitle>
                    <p className="text-center text-gray-500 dark:text-gray-400">
                        {currentStep.description}
                    </p>
                </DialogHeader>

                <div className="flex gap-1 justify-center py-4">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                "h-1.5 rounded-full transition-all duration-300",
                                i === step ? "w-6 bg-purple-600" : "w-1.5 bg-gray-200 dark:bg-gray-800"
                            )}
                        />
                    ))}
                </div>

                <DialogFooter className="sm:justify-stretch">
                    <Button
                        onClick={handleNext}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-12 text-lg"
                    >
                        {isLastStep ? (
                            <span className="flex items-center gap-2">Let's Go! <Zap className="w-4 h-4" /></span>
                        ) : (
                            <span className="flex items-center gap-2">Next <ArrowRight className="w-4 h-4" /></span>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
