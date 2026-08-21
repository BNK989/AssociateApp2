import { motion } from 'framer-motion';

/** Perimeter of the rounded 38x38 rect, used as the dash length. */
const PERIMETER = 140;

type HintProgressRingProps = {
    /** 0–100; how far the auto-hint countdown has run. */
    progress: number;
};

/** Ring around the hint button that drains as the auto-hint timer counts down. */
export function HintProgressRing({ progress }: HintProgressRingProps) {
    const offset = PERIMETER * (1 - progress / 100);

    return (
        <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
            <svg className="h-full w-full" viewBox="0 0 40 40">
                <rect
                    x="1" y="1" width="38" height="38" rx="7" ry="7"
                    fill="none" stroke="currentColor" strokeWidth="3"
                    className="text-purple-500/30"
                />
                <motion.rect
                    x="1" y="1" width="38" height="38" rx="7" ry="7"
                    fill="none" stroke="currentColor" strokeWidth="3"
                    className="text-purple-600 dark:text-purple-400"
                    strokeDasharray={PERIMETER}
                    strokeDashoffset={offset}
                    initial={{ strokeDashoffset: PERIMETER }}
                    animate={{ strokeDashoffset: offset }}
                    // Matches the one-second timer tick, so it drains smoothly.
                    transition={{ duration: 1, ease: 'linear' }}
                />
            </svg>
        </div>
    );
}
