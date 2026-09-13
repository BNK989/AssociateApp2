import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { HintDisplay } from './messageFlags';
import { ClueSkeleton, ClueText } from './ClueText';
import { useMeasuredHeight } from './useMeasuredHeight';

/** The panel's own opening, and every later change of its content's height. */
const PANEL_EASE = [0.22, 0.61, 0.36, 1] as const;
const PANEL_MS = 0.34;

const DISCLOSURE_REVEAL = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto' },
    exit: { opacity: 0, height: 0 },
    transition: { duration: 0.2, ease: 'easeOut' as const },
};

/**
 * The last rung of the ladder — a written clue — rendered for the stage the
 * bubble is in.
 *
 * The clue is the loudest thing a bubble can carry, so it is only allowed to
 * stay loud while it is still doing work. Once the word is settled the clue has
 * been spent — the answer is right there above it — and it collapses to a chip
 * the player can reopen if they want to see what they were given. That keeps
 * the scroll readable: a chain of solved words used to cost ninety pixels of
 * amber each, which crowded the one word still being played off the screen.
 *
 * The amber is gone too. It was `yellow-100`/`yellow-900` with an `indigo` wait
 * state — two hardcoded palettes that belonged to no theme, on the one surface
 * sitting inside a bubble whose own colours are carefully tuned. It wears the
 * brand accent now, and the text decodes in out of the board's own cipher
 * glyphs instead of simply appearing.
 */
export function HintPanel({ display, hint }: { display: HintDisplay; hint?: string }) {
    if (display === 'none') return null;
    if (display === 'collapsed') return <SpentHint hint={hint} />;

    return <OpenHint hint={hint} />;
}

/**
 * The clue while it is still the working surface for the active word.
 *
 * The bubble grows around a measured height rather than around `height: 'auto'`
 * under a `layout` animation. That pairing was doing three things at once — a
 * spring on the layout projection, a tween on the height, and a `scale` from
 * 0.95 — so the panel arrived squashed, shimmering along its border, and then
 * jumped a second time, unanimated, when the clue replaced the placeholder.
 * One measured number carries both changes now, and the content inside is never
 * scaled.
 *
 * The `pt-2` that separates the panel from the word lives *inside* the animated
 * box: as a margin on the outside it was 8px that appeared the instant the
 * panel mounted, before the panel had any height to justify it.
 */
function OpenHint({ hint }: { hint?: string }) {
    const t = useTranslations('GameRoom.Chat');
    const reduced = Boolean(useReducedMotion());
    const { ref, height } = useMeasuredHeight<HTMLDivElement>();

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: height ?? 'auto' }}
            transition={reduced ? { duration: 0 } : {
                height: { duration: PANEL_MS, ease: PANEL_EASE },
                opacity: { duration: 0.22, ease: 'easeOut' },
            }}
            className="overflow-hidden"
        >
            <div ref={ref} className="pt-2">
                <div className="flex items-start gap-2 rounded-lg border border-brand/30 border-s-2 border-s-brand bg-brand-subtle px-2.5 py-2 text-xs font-medium text-brand-subtle-foreground shadow-[0_0_14px_-6px_var(--brand)]">
                    <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand/15">
                        <Lightbulb className="h-3 w-3" aria-hidden="true" />
                    </span>

                    {hint ? (
                        <span className="leading-snug">
                            <ClueText text={hint} />
                        </span>
                    ) : (
                        <span className="flex items-baseline gap-2 leading-snug">
                            <ClueSkeleton />
                            <span className="text-[10px] uppercase tracking-wide opacity-70">
                                {t('decoding_clue')}
                            </span>
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

/**
 * The clue on a settled word: a one-line record that it was used, opening on
 * demand. Doubles as the only place the player can see, mid-game, which words
 * cost them a hint.
 */
function SpentHint({ hint }: { hint?: string }) {
    const t = useTranslations('GameRoom.Chat');
    const [open, setOpen] = useState(false);

    if (!hint) return null;

    return (
        <div className="mt-1.5">
            <button
                type="button"
                aria-expanded={open}
                onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
                onMouseDown={(e) => e.preventDefault()}
                className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-brand-subtle-foreground"
            >
                <Lightbulb className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>{t('hint_used')}</span>
                <ChevronDown
                    className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.p
                        {...DISCLOSURE_REVEAL}
                        className="overflow-hidden text-xs leading-snug text-foreground/80 ps-4 pt-1"
                    >
                        {hint}
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
}
