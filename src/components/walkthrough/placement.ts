/**
 * Where a walkthrough card goes.
 *
 * Split out of the popover and made pure because the old version could not be
 * reasoned about or tested: it placed a card above its target with
 * `rect.top - padding - 200`, a literal comment-flagged "rough height guess".
 * Anything shorter than 200px floated away from what it was pointing at and
 * anything taller covered it, and neither could be seen without running the app
 * in the right locale at the right width.
 *
 * Everything here is arithmetic on measured boxes, so the popover measures
 * itself and asks, and the awkward cases -- a target at the bottom of a phone,
 * a card wider than the gap beside it -- are covered by tests instead of by
 * hope.
 */

export type Box = { top: number; left: number; width: number; height: number };

export type Viewport = { width: number; height: number };

/** Which side of the target the card was asked for, or `center` for no target. */
export type Side = 'top' | 'bottom' | 'center';

export type Placed = {
    /** Where it ended up, which is not always what was asked for. */
    side: Side;
    top: number;
    left: number;
    /**
     * Distance from the card's physical left edge to the point the arrow should
     * mark, or null when the card is centred and has no arrow.
     *
     * Physical rather than logical on purpose: these are viewport coordinates
     * from `getBoundingClientRect`, which do not mirror in RTL. Flipping them
     * would point the arrow at the wrong side of the screen.
     */
    arrowLeft: number | null;
};

/** Breathing room between the card and the thing it describes. */
export const GAP = 14;

/** How close the card may come to the edge of the screen. */
export const MARGIN = 12;

/** How close the arrow may come to the corner of the card before it looks detached. */
const ARROW_INSET = 20;

function clamp(value: number, min: number, max: number): number {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
}

/** Centred, with no arrow: the opening step, and the fallback when nothing fits. */
function centred(popover: Box, viewport: Viewport): Placed {
    return {
        side: 'center',
        top: Math.max(MARGIN, (viewport.height - popover.height) / 2),
        left: Math.max(MARGIN, (viewport.width - popover.width) / 2),
        arrowLeft: null,
    };
}

/** Whether the card, plus its gap and margin, actually fits on that side. */
function fits(side: 'top' | 'bottom', target: Box, popover: Box, viewport: Viewport): boolean {
    const needed = popover.height + GAP + MARGIN;

    return side === 'top'
        ? target.top >= needed
        : viewport.height - (target.top + target.height) >= needed;
}

export type PlaceArgs = {
    /** The element being pointed at, or null when there is nothing to anchor to. */
    target: Box | null;
    popover: Box;
    viewport: Viewport;
    preferred: Side;
};

/**
 * Places the card, flipping sides rather than running off the screen.
 *
 * The order is: honour the requested side if it fits, take the other side if it
 * does not, and centre if neither does -- which happens on a short phone
 * viewport with the keyboard up. The horizontal clamp is applied after the side
 * is chosen, and the arrow is placed against the *target*, so a card pushed
 * away from centre by the clamp still points at the right thing. It previously
 * sat at a hardcoded 50%, marking whatever happened to be under the middle of
 * the card.
 */
export function placePopover({ target, popover, viewport, preferred }: PlaceArgs): Placed {
    if (!target || preferred === 'center') return centred(popover, viewport);

    const other = preferred === 'top' ? 'bottom' : 'top';
    const side = fits(preferred, target, popover, viewport)
        ? preferred
        : fits(other, target, popover, viewport) ? other : null;

    if (!side) return centred(popover, viewport);

    const top = side === 'top'
        ? target.top - GAP - popover.height
        : target.top + target.height + GAP;

    const targetCentre = target.left + target.width / 2;
    const left = clamp(
        targetCentre - popover.width / 2,
        MARGIN,
        viewport.width - popover.width - MARGIN,
    );

    return {
        side,
        top,
        left,
        arrowLeft: clamp(targetCentre - left, ARROW_INSET, popover.width - ARROW_INSET),
    };
}
