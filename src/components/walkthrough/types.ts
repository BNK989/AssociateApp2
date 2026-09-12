import type { LucideIcon } from 'lucide-react';

export type WalkthroughStep = {
    id: string;
    /** DOM id of the element to highlight. Empty for a step with no anchor. */
    targetId: string;
    title: string;
    content: string;
    /**
     * Which side of the target to prefer. The tour flips it when there is no
     * room, so this is a preference and not a promise -- see `placement.ts`.
     */
    position?: 'top' | 'bottom' | 'center';
    /**
     * Shown in a tinted chip beside the title.
     *
     * A step reads as a piece of the product rather than as a generic tooltip
     * when it carries the same icon the control it describes does, which is why
     * this is a Lucide component and not a decorative choice per tour.
     */
    icon?: LucideIcon;
    onNext?: () => void;
    onPrev?: () => void;
};

export type WalkthroughOptions = {
    onSkip?: () => void;
    onComplete?: () => void;
    /**
     * What the last step's button says, when "Finish" is not the point.
     *
     * A tour that ends by handing the player a board should say so -- "Play
     * now" is an invitation and "Finish" is paperwork -- and the tour knows
     * that, while this generic component does not.
     */
    finishLabel?: string;
};
