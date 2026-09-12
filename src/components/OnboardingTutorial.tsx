'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ArrowRight, CalendarDays, Link2, Sparkles, Users, type LucideIcon } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type OnboardingTutorialProps = {
    open: boolean;
    onComplete: () => void;
};

/**
 * What a new account is told, in order.
 *
 * The old four were "Welcome", "Phase 1: Chatting", "Phase 2: Solving" and
 * "Ready?", which described a game that no longer leads: they named the
 * multiplayer rounds and never mentioned the daily chain, which is now the
 * front door and the only thing most accounts will ever play. The order here
 * is what the game is, what you play today, what you can play with friends,
 * and then out of the way.
 */
const STEPS: { key: string; icon: LucideIcon }[] = [
    { key: 'welcome', icon: Sparkles },
    { key: 'daily', icon: CalendarDays },
    { key: 'friends', icon: Users },
    { key: 'ready', icon: Link2 },
];

/**
 * The first-run dialog, shown once per account from the lobby.
 *
 * Visually it is deliberately the same object as the daily walkthrough -- the
 * tinted icon chip, the widening progress dots, the brand-coloured primary --
 * because a player meets both within a minute of each other and two different
 * house styles read as two different products.
 */
export function OnboardingTutorial({ open, onComplete }: OnboardingTutorialProps) {
    const [step, setStep] = useState(0);
    const t = useTranslations('Onboarding');

    const current = STEPS[step];
    const Icon = current.icon;
    const isLastStep = step === STEPS.length - 1;

    const handleNext = () => {
        if (isLastStep) {
            onComplete();
            return;
        }
        setStep((previous) => previous + 1);
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onComplete()}>
            <DialogContent className="sm:max-w-md rounded-2xl border-border bg-background">
                <DialogHeader>
                    <div className="flex justify-center pb-1">
                        <motion.span
                            key={current.key}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-subtle text-brand-subtle-foreground"
                        >
                            <Icon className="h-7 w-7" aria-hidden="true" />
                        </motion.span>
                    </div>

                    {/*
                      * Both halves are keyed on the step so each one animates as
                      * the copy is replaced. Without the key React reuses the
                      * node and the text simply blinks from one string to the
                      * next, which is what the previous version did.
                      */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={current.key}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                        >
                            <DialogTitle className="text-center text-2xl font-bold text-foreground">
                                {t(`${current.key}.title`)}
                            </DialogTitle>

                            <DialogDescription className="mt-2 text-center text-base leading-relaxed text-muted-foreground">
                                {t(`${current.key}.description`)}
                            </DialogDescription>
                        </motion.div>
                    </AnimatePresence>
                </DialogHeader>

                <div className="flex items-center justify-center gap-1.5 py-2">
                    {STEPS.map((entry, index) => (
                        <span
                            key={entry.key}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                index === step ? 'w-6 bg-brand' : 'w-1.5 bg-border'
                            }`}
                        />
                    ))}
                    <span className="sr-only">{t('progress', { current: step + 1, total: STEPS.length })}</span>
                </div>

                <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
                    {step > 0 ? (
                        <Button
                            variant="ghost"
                            onClick={() => setStep((previous) => previous - 1)}
                            className="text-muted-foreground"
                        >
                            {t('back')}
                        </Button>
                    ) : (
                        <Button variant="ghost" onClick={onComplete} className="text-muted-foreground">
                            {t('skip')}
                        </Button>
                    )}

                    <Button
                        onClick={handleNext}
                        className="h-11 gap-2 rounded-xl bg-brand px-6 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90"
                    >
                        {isLastStep ? t('lets_go') : t('next')}
                        {!isLastStep && <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
