import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
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
    const t = useTranslations('Onboarding');

    const steps = [
        {
            title: t('welcome.title'),
            description: t('welcome.description'),
            icon: <Zap className="w-12 h-12 text-yellow-500" />,
            color: "bg-yellow-50 dark:bg-yellow-900/20",
        },
        {
            title: t('phase1.title'),
            description: t('phase1.description'),
            icon: <MessageSquare className="w-12 h-12 text-blue-500" />,
            color: "bg-blue-50 dark:bg-blue-900/20",
        },
        {
            title: t('phase2.title'),
            description: t('phase2.description'),
            icon: <Zap className="w-12 h-12 text-purple-500" />,
            color: "bg-purple-50 dark:bg-purple-900/20",
        },
        {
            title: t('ready.title'),
            description: t('ready.description'),
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
                            <span className="flex items-center gap-2">{t('lets_go')} <Zap className="w-4 h-4" /></span>
                        ) : (
                            <span className="flex items-center gap-2">{t('next')} <ArrowRight className="w-4 h-4 rtl:rotate-180" /></span>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
