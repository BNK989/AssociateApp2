import type { Variants } from 'framer-motion';

/** Widest tilt a loose tile may take. */
const MAX_TILT_DEG = 6;

/**
 * Idle drift for loose letters, so they read as tiles waiting to be placed
 * rather than settled text.
 *
 * Only applied to tiles whose slot is not the letter's own — see `ScrambleView`.
 * The rotation is derived rather than randomised, so a tile keeps its tilt
 * across re-renders instead of twitching.
 *
 * The tilt used to reach 24 degrees, which costs real legibility for no added
 * meaning; the drift alone carries the signal. It is worst in Hebrew and
 * Arabic, where the app's own script is already doing more work.
 */
export const floatVariant: Variants = {
    float: (i: number) => {
        const sign = i % 2 === 0 ? 1 : -1;
        const magnitude = 2 + ((i * 1337) % (MAX_TILT_DEG - 1));

        return {
            y: [0, -4, 0],
            rotate: sign * magnitude,
            transition: {
                y: { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 },
                rotate: { duration: 0 },
            },
        };
    },
};

/** One-shot flash when a letter is newly revealed by a bought hint. */
export const popVariant: Variants = {
    pop: (isMatch: boolean) => ({
        scale: [1, 1.5, 1],
        textShadow: isMatch
            ? ['0px 0px 0px rgba(0,0,0,0)', '0px 0px 8px rgba(251, 191, 36, 0.8)', '0px 0px 0px rgba(0,0,0,0)']
            : 'none',
        transition: { duration: 0.4, ease: 'easeOut' },
    }),
};
