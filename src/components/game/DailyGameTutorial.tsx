import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowUp, Zap, Calendar, ArrowRight, Lightbulb } from 'lucide-react'; // Changed ArrowDown/Up logic to match "Work Backwards"
import { cn } from "@/lib/utils";

type DailyGameTutorialProps = {
    open: boolean;
    onComplete: () => void;
};

export function DailyGameTutorial({ open, onComplete }: DailyGameTutorialProps) {
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: "Daily Challenge 📅",
            description: "Welcome to your daily mental workout! Every day, we release a new chain of a few connected words.",
            icon: <Calendar className="w-12 h-12 text-orange-500" />,
            color: "bg-orange-50 dark:bg-orange-900/20",
        },
        {
            title: "Work Backwards ⬆️",
            description: "The last word is already revealed. Your goal is to guess the word that comes BEFORE it. Solving one word reveals the next one up the chain!",
            icon: <ArrowUp className="w-12 h-12 text-blue-500" />,
            color: "bg-blue-50 dark:bg-blue-900/20",
        },
        {
            title: "Need a Hint? 💡",
            description: "Stuck on a tricky connection? Tap the bulb icon for a hint. It costs a few points, but it's better than breaking your streak!",
            icon: <Lightbulb className="w-12 h-12 text-yellow-500" />,
            color: "bg-yellow-50 dark:bg-yellow-900/20",
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
                    <DialogTitle className="text-center text-2xl font-bold mb-2 dark:text-white">
                        {currentStep.title}
                    </DialogTitle>
                    <p className="text-center text-gray-500 dark:text-gray-400 text-lg">
                        {currentStep.description}
                    </p>
                </DialogHeader>

                <div className="flex gap-2 justify-center py-6">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                "h-2 rounded-full transition-all duration-300",
                                i === step ? "w-8 bg-purple-600" : "w-2 bg-gray-200 dark:bg-gray-700"
                            )}
                        />
                    ))}
                </div>

                <DialogFooter className="sm:justify-stretch">
                    <Button
                        onClick={handleNext}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-12 text-lg shadow-lg shadow-purple-500/20"
                    >
                        {isLastStep ? (
                            <span className="flex items-center gap-2">Play Now <Zap className="w-5 h-5" /></span>
                        ) : (
                            <span className="flex items-center gap-2">Next <ArrowRight className="w-5 h-5" /></span>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
