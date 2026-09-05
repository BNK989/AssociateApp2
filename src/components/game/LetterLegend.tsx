'use client';

import { useTranslations } from 'next-intl';

/** One example tile per state, so the key shows the thing it describes. */
const SAMPLES = [
    { state: 'placed', char: 'A', color: 'var(--tile-placed)' },
    { state: 'present', char: 'B', color: 'var(--tile-present)' },
    { state: 'unknown', char: '⊗', color: 'var(--tile-unknown)' },
] as const;

/**
 * Whether tile order currently carries information.
 *
 * Colour alone cannot say this: an orange letter sits at its real index below
 * the shuffle hint and at a meaningless one above it. Rather than overload the
 * colour with a second meaning, the board states the rule outright and the
 * caller says which half applies. `both` is for the rules dialog, which is read
 * away from any particular word.
 */
type PositionNote = 'ordered' | 'shuffled' | 'both';

type LetterLegendProps = {
    positionNote?: PositionNote;
    className?: string;
};

/**
 * The key to what a masked word's colours mean.
 *
 * Rendered with the same `--tile-*` variables the board uses rather than fixed
 * swatches, so the sample tiles are the colours the player is actually looking
 * at — including on the indigo own-message surface, where the palette differs.
 *
 * This exists because the rules were told exactly once, in a first-run tour
 * step dismissed forever by a localStorage key, and never in Classic mode at
 * all. The moment a player needs the key is the first time a tile changes
 * colour, which is not the moment they arrived.
 */
export function LetterLegend({ positionNote = 'both', className = '' }: LetterLegendProps) {
    const t = useTranslations('GameRoom.Legend');

    const notes: string[] = [];
    if (positionNote === 'ordered' || positionNote === 'both') notes.push(t('ordered_note'));
    if (positionNote === 'shuffled' || positionNote === 'both') notes.push(t('shuffled_note'));

    return (
        <div className={`space-y-2.5 ${className}`}>
            {SAMPLES.map(({ state, char, color }) => (
                <div key={state} className="flex items-start gap-3">
                    <span
                        aria-hidden="true"
                        className="mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-md border border-border bg-muted font-mono text-base font-bold"
                        style={{ color }}
                    >
                        {char}
                    </span>
                    <p className="text-sm leading-snug text-muted-foreground">
                        <span className="font-bold text-foreground">{t(`${state}_title`)}</span>
                        {' — '}
                        {t(`${state}_desc`)}
                    </p>
                </div>
            ))}

            {notes.map((note) => (
                <p key={note} className="border-s-2 border-border ps-3 text-sm leading-snug text-muted-foreground">
                    {note}
                </p>
            ))}
        </div>
    );
}
