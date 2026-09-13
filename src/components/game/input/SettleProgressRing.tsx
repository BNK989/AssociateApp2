import { motion } from 'framer-motion';

/** Perimeter of the rounded 38x38 rect, used as the dash length. */
const PERIMETER = 140;

type SettleProgressRingProps = {
    /** 0–100; how far the wait for the next letter has run. */
    progress: number;
};

/**
 * Ring around the settle button that **fills** as the next letter approaches.
 *
 * The one visual difference from `HintProgressRing`, and the whole reason this
 * is a separate component rather than a `direction` prop: that ring drains, and
 * a draining ring reads as time running out. It is the right shape there — the
 * auto-hint clock is counting down to a hint that will cost the player points.
 *
 * This clock brings a letter. Filling is what says *something is arriving*
 * rather than *something is expiring*, and a player watching an empty ring fill
 * has a reason to stay on the word — which is the entire job of the mechanic it
 * belongs to. Same vocabulary, opposite direction, and the direction is the
 * message.
 */
export function SettleProgressRing({ progress }: SettleProgressRingProps) {
    const offset = PERIMETER * (1 - progress / 100);

    return (
        <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
            <svg className="h-full w-full" viewBox="0 0 40 40">
                <rect
                    x="1" y="1" width="38" height="38" rx="7" ry="7"
                    fill="none" stroke="currentColor" strokeWidth="3"
                    className="text-[var(--tile-present)]/20"
                />
                <motion.rect
                    x="1" y="1" width="38" height="38" rx="7" ry="7"
                    fill="none" stroke="currentColor" strokeWidth="3"
                    // The orange of a found-but-unplaced letter, because that is
                    // precisely what the ring is counting down to placing. The
                    // player has already learned that colour on the tiles
                    // hanging around the word.
                    className="text-[var(--tile-present)]"
                    strokeDasharray={PERIMETER}
                    strokeDashoffset={offset}
                    initial={{ strokeDashoffset: PERIMETER }}
                    animate={{ strokeDashoffset: offset }}
                    // Matches the clock's own tick, so it advances smoothly
                    // rather than in visible steps.
                    transition={{ duration: 0.25, ease: 'linear' }}
                />
            </svg>
        </div>
    );
}
