'use client';

import { useTranslations } from 'next-intl';
import { tileClassName } from '@/components/cipher/tileStyles';
import type { TileState } from '@/components/cipher/cipherRules';
import { DEFAULT_LEGEND_SAMPLES, type LegendSamples } from '@/components/game/chat/legendRules';

/** The order the states are read in: earned, half-earned, still hidden. */
const SAMPLE_ORDER: TileState[] = ['placed', 'present', 'unknown'];

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

/**
 * How much room the key has.
 *
 * `stacked` is the reference reading — one row per state with its full
 * description. `inline` is the same three states condensed to a single wrapped
 * row, for the key that opens inside a chat bubble, where a hundred pixels of
 * prose would push the word being solved off the screen.
 */
type LegendVariant = 'stacked' | 'inline';

type LetterLegendProps = {
    positionNote?: PositionNote;
    /**
     * Characters to draw the sample tiles with. Defaults to generic examples;
     * pass the live word's own tiles (`pickLegendSamples`) wherever the key is
     * opened next to a word, so the player recognises the samples.
     */
    samples?: LegendSamples;
    variant?: LegendVariant;
    className?: string;
};

/**
 * The key to what a masked word's colours mean.
 *
 * Sample tiles are drawn with `tileClassName`, the very function the board uses,
 * so the key shows both channels — hue *and* underline — exactly as they appear
 * in play. A hand-built swatch would drift from the thing it describes, and
 * would teach only the half of the encoding that colour carries.
 *
 * This exists because the rules were told exactly once, in a first-run tour
 * step dismissed forever by a localStorage key, and never in Classic mode at
 * all. The moment a player needs the key is the first time a tile changes
 * colour, which is not the moment they arrived.
 */
export function LetterLegend({
    positionNote = 'both',
    variant = 'stacked',
    samples = DEFAULT_LEGEND_SAMPLES,
    className = '',
}: LetterLegendProps) {
    const t = useTranslations('GameRoom.Legend');
    const isInline = variant === 'inline';

    const notes: string[] = [];
    if (positionNote === 'ordered' || positionNote === 'both') {
        notes.push(t(isInline ? 'ordered_note_short' : 'ordered_note'));
    }
    if (positionNote === 'shuffled' || positionNote === 'both') {
        notes.push(t(isInline ? 'shuffled_note_short' : 'shuffled_note'));
    }

    if (isInline) {
        return (
            <div className={`space-y-1.5 ${className}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    {SAMPLE_ORDER.map((state) => (
                        <span key={state} className="flex items-center gap-1.5">
                            <span
                                aria-hidden="true"
                                className={`grid h-6 w-6 flex-none place-items-center rounded border border-border bg-muted font-mono text-xs ${tileClassName(state)}`}
                            >
                                {samples[state]}
                            </span>
                            <span className="text-[11px] font-bold leading-none">
                                {t(`${state}_short`)}
                            </span>
                        </span>
                    ))}
                </div>

                {notes.map((note) => (
                    <p key={note} className="text-[11px] leading-snug opacity-75">{note}</p>
                ))}
            </div>
        );
    }

    return (
        <div className={`space-y-2.5 ${className}`}>
            {SAMPLE_ORDER.map((state) => (
                <div key={state} className="flex items-start gap-3">
                    <span
                        aria-hidden="true"
                        className={`mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-md border border-border bg-muted font-mono text-base ${tileClassName(state)}`}
                    >
                        {samples[state]}
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
