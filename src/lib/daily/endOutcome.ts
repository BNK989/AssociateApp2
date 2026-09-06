import { countSolved, type ShareSquare } from './dailyShare';

/**
 * How a finished chain is characterised to the player.
 *
 * The end screen used to congratulate everyone identically -- fireworks, a
 * trophy and "Daily Challenge Complete!" -- whether they had solved every word
 * or none of them. Telling someone who missed most of the chain that they
 * "solved all 8 words" is worse than saying nothing: it reads as the game not
 * having noticed, and it makes the result not worth sharing.
 */
export type DailyOutcomeTier = 'perfect' | 'strong' | 'partial' | 'blank';

/** At or above this share of the chain the day still counts as a good run. */
const STRONG_THRESHOLD = 0.6;

export type ChainOutcome = {
    tier: DailyOutcomeTier;
    solved: number;
    total: number;
    /**
     * Whether the result earns the firework. Confetti over a blank board is the
     * clearest possible signal that the screen is not reading the game.
     */
    celebrate: boolean;
};

/**
 * Reads the outcome off the share grid rather than off the score.
 *
 * The grid is already the canonical per-word verdict -- it is what decides a
 * green, yellow or white square -- so deriving the headline from the same
 * source means the words on the screen can never contradict the squares
 * underneath them or the ones the player pastes into a chat.
 */
export function resolveChainOutcome(squares: ShareSquare[]): ChainOutcome {
    const total = squares.length;
    const solved = countSolved(squares);

    let tier: DailyOutcomeTier = 'blank';
    if (total > 0 && solved === total) tier = 'perfect';
    else if (solved === 0) tier = 'blank';
    else if (solved / total >= STRONG_THRESHOLD) tier = 'strong';
    else tier = 'partial';

    return {
        tier,
        solved,
        total,
        celebrate: tier === 'perfect' || tier === 'strong',
    };
}
