'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { placePopover, type Box, type Placed } from './placement';
import type { WalkthroughStep } from './types';

/** Width of the card: comfortable on a desktop, gutter-safe on a small phone. */
const CARD_WIDTH = 'w-[min(20rem,calc(100vw-1.5rem))]';

type WalkthroughPopoverProps = {
    step: WalkthroughStep;
    targetRect: Box | null;
    current: number;
    total: number;
    /** Overrides the last step's button, when the tour has a better word for it. */
    finishLabel?: string;
    onNext: () => void;
    onPrev: () => void;
    onSkip: () => void;
};

/**
 * The card that explains one step.
 *
 * It measures itself and then places itself (`placement.ts`), in that order --
 * which is the whole difference from the version that assumed it was 200px
 * tall and drifted away from its target in every locale whose copy wrapped
 * differently. The first paint is invisible rather than misplaced: `opacity-0`
 * until a real measurement exists, so nothing is ever seen in the wrong place.
 */
export function WalkthroughPopover({
    step, targetRect, current, total, finishLabel, onNext, onPrev, onSkip,
}: WalkthroughPopoverProps) {
    const t = useTranslations('Walkthrough');
    const cardRef = useRef<HTMLDivElement>(null);
    const [placed, setPlaced] = useState<Placed | null>(null);

    // Layout effect so the measure-then-place round trip lands before paint.
    useLayoutEffect(() => {
        const card = cardRef.current;
        if (!card) return;

        const place = () => {
            const { width, height } = card.getBoundingClientRect();

            setPlaced(placePopover({
                target: targetRect,
                popover: { top: 0, left: 0, width, height },
                viewport: { width: window.innerWidth, height: window.innerHeight },
                preferred: step.position ?? 'bottom',
            }));
        };

        place();

        // The card's own height changes when the copy does -- a longer
        // translation, a wrapped title -- so it is watched, not measured once.
        const observer = new ResizeObserver(place);
        observer.observe(card);
        window.addEventListener('resize', place);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', place);
        };
    }, [targetRect, step.position, step.id]);

    // Moves focus to the card as each step opens, so a keyboard or screen
    // reader follows the tour instead of being left behind on the board.
    useEffect(() => {
        cardRef.current?.focus({ preventScroll: true });
    }, [step.id]);

    const isLast = current === total - 1;
    const Icon = step.icon;

    return (
        <motion.div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`walkthrough-title-${step.id}`}
            aria-describedby={`walkthrough-body-${step.id}`}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: placed ? 1 : 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ top: placed?.top ?? 0, left: placed?.left ?? 0 }}
            className={`fixed z-[60] ${CARD_WIDTH} rounded-2xl border border-border bg-popover p-5 text-popover-foreground shadow-2xl outline-none`}
        >
            {placed?.arrowLeft !== null && placed !== null && (
                <span
                    aria-hidden="true"
                    // Viewport geometry, not layout: `left` here is a measured
                    // coordinate and must not mirror in RTL. See placement.ts.
                    style={{ left: placed.arrowLeft }}
                    className={`absolute h-3 w-3 -translate-x-1/2 rotate-45 border-border bg-popover ${
                        placed.side === 'top'
                            ? '-bottom-1.5 border-b border-e'
                            : '-top-1.5 border-s border-t'
                    }`}
                />
            )}

            <div className="flex items-start gap-3">
                {Icon && (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand-subtle-foreground">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                )}

                <h2
                    id={`walkthrough-title-${step.id}`}
                    className="flex-1 text-base font-semibold leading-snug text-foreground"
                >
                    {step.title}
                </h2>

                <button
                    type="button"
                    onClick={onSkip}
                    aria-label={t('skip')}
                    className="-me-1.5 -mt-1.5 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>

            <p
                id={`walkthrough-body-${step.id}`}
                className="mt-2.5 text-sm leading-relaxed text-muted-foreground"
            >
                {step.content}
            </p>

            <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5" role="presentation">
                    {Array.from({ length: total }, (_, index) => (
                        <span
                            key={index}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                index === current ? 'w-5 bg-brand' : 'w-1.5 bg-border'
                            }`}
                        />
                    ))}
                    <span className="sr-only">{t('progress', { current: current + 1, total })}</span>
                </div>

                <div className="flex items-center gap-1">
                    {current > 0 && (
                        <Button variant="ghost" size="sm" onClick={onPrev} className="h-8 px-2.5 text-muted-foreground">
                            {t('back')}
                        </Button>
                    )}

                    <Button
                        size="sm"
                        onClick={onNext}
                        className="h-8 gap-1 bg-brand px-3 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90"
                    >
                        {isLast ? (finishLabel ?? t('finish')) : t('next')}
                        {!isLast && <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />}
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}
