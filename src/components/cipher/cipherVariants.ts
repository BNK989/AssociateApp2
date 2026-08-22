import type { Variants } from 'framer-motion';

/**
 * Idle drift for revealed letters, so they read as "loose" tiles waiting to be
 * placed rather than settled text.
 *
 * The rotation is derived from the index rather than randomised, so a letter
 * keeps the same tilt across re-renders instead of twitching.
 */
export const floatVariant: Variants = {
    float: (i: number) => {
        const sign = i % 2 === 0 ? 1 : -1;
        const magnitude = 5 + ((i * 1337) % 20);

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
