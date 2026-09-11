import { useReducedMotion } from 'framer-motion';
import { SlotCell } from './SlotCell';
import type { SlotGroup } from '@/lib/letterPool/poolRules';

type SlotStripProps = {
    groups: SlotGroup[];
    /** Longest word, which is what cell width is sized against. */
    longest: number;
    /** Index of the cell the next keystroke fills, or null when the strip is full. */
    caretIndex: number | null;
    dir: 'ltr' | 'rtl';
};

/**
 * The answer's shape, drawn inside the composer.
 *
 * How a phrase stays legible: cells are grouped into words and the strip wraps
 * *between* groups, so "morning glory" becomes two lines of full-size cells
 * rather than thirteen cramped ones. Cell width is then sized against the
 * longest single word, not the whole answer — that is the only measurement that
 * has to fit on one line.
 *
 * The sizing is a container query rather than a measured value: no
 * `ResizeObserver`, no layout read on the render path, and it re-solves on a
 * keyboard opening or an orientation change for free. The floor of 18px is
 * where a mono glyph stops being readable; the ceiling of 32px is where cells
 * start to look like a separate game from the word above them.
 *
 * This replaces the `typed / total` counter, which existed only to tell the
 * player how long the answer was. The strip says that natively, so the
 * composer's height is unchanged.
 */
export function SlotStrip({ groups, longest, caretIndex, dir }: SlotStripProps) {
    const reduced = Boolean(useReducedMotion());

    return (
        <div
            dir={dir}
            // In flow, not overlaid: the strip is what gives the field its
            // height, so a phrase that wraps to two rows grows the field
            // instead of spilling out of a fixed 40px box.
            className="slot-strip pointer-events-none relative flex min-h-10 flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 py-1.5"
            style={{ '--slot-count': longest } as React.CSSProperties}
            aria-hidden="true"
        >
            {groups.map((group, groupIndex) => (
                <span
                    key={group.slots[0]?.index ?? `gap-${groupIndex}`}
                    // A word never breaks across lines; the strip wraps around it.
                    className="flex flex-none items-center gap-px"
                >
                    {group.slots.map((slot) => (
                        <SlotCell
                            key={slot.index}
                            slot={slot}
                            isCaret={slot.index === caretIndex}
                            reduced={reduced}
                        />
                    ))}
                </span>
            ))}
        </div>
    );
}
