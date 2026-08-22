import { CIPHER_SIGNS, GAME_CONFIG, HINT_COSTS, MAX_STRIKES } from './gameConfig';

// Re-exported so the ~20 existing import sites keep working; the definitions
// now live in gameConfig.ts alongside the rest of the game's balance.
export { HINT_COSTS, MAX_STRIKES };

export const calculateMessageValue = (content: string): number => {
    // Base value 10 + 1 point per character
    // Strip whitespace to avoid gaming the system with spaces? 
    // Requirement says "1 point per character", usually implies visible chars, but simple length is often used.
    // Let's stick to simple length for now as it's predictable.
    return 10 + content.length;
};

export const calculateSimilarity = (guess: string, target: string): number => {
    // Basic fuzzy match implementation (Levenshtein distance based could be better, but simple containment/ratio for now)
    // For now, let's implement a simple case-insensitive checking. 
    // True fuzzy matching > 80% usually requires a library like 'fast-levenshtein' or similar. 
    // If no library is available, I will implement a basic Levenshtein distance function.

    const a = guess.toLowerCase().trim();
    const b = target.toLowerCase().trim();

    if (a === b) return 1.0;
    if (!a || !b) return 0.0;

    const distance = levenshteinDistance(a, b);
    const maxLength = Math.max(a.length, b.length);

    return 1.0 - (distance / maxLength);
};

const levenshteinDistance = (a: string, b: string): number => {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i += 1) {
        matrix[0][i] = i;
    }

    for (let j = 0; j <= b.length; j += 1) {
        matrix[j][0] = j;
    }

    for (let j = 1; j <= b.length; j += 1) {
        for (let i = 1; i <= a.length; i += 1) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1, // deletion
                matrix[j - 1][i] + 1, // insertion
                matrix[j - 1][i - 1] + indicator, // substitution
            );
        }
    }

    return matrix[b.length][a.length];
};

export type PointDistribution = {
    totalPoints: number;
    winnerPoints: number;
    authorPoints: number;
    type: 'SELF_RESCUE' | 'STEAL';
};

export const calculatePointDistribution = (
    wordValue: number,
    guesserId: string,
    authorId: string,
    multiplier: number = 1
): PointDistribution => {
    const totalPotential = wordValue * multiplier;

    if (guesserId === authorId) {
        // Self-Rescue: 50% value
        const points = Math.floor(totalPotential * 0.5);
        return {
            totalPoints: points,
            winnerPoints: points,
            authorPoints: 0,
            type: 'SELF_RESCUE'
        };
    } else {
        // The Steal: 75% to guesser, 25% to author
        const winnerPoints = Math.floor(totalPotential * 0.75);
        const authorPoints = Math.floor(totalPotential * 0.25);
        return {
            totalPoints: winnerPoints + authorPoints,
            winnerPoints,
            authorPoints,
            type: 'STEAL'
        };
    }
};

export const generateCipherString = (content: string, level: number, isDaily: boolean = false): string => {
    const length = content.length;

    // Calculate indices for non-space characters
    const indices: number[] = [];
    for (let i = 0; i < length; i++) {
        if (content[i] !== ' ') {
            indices.push(i);
        }
    }

    const revealedIndices = new Set<number>();

    // Level 1+: Reveal First Letter (always true for hints)
    if (level >= 1 && indices.length > 0) {
        revealedIndices.add(indices[0]);
    }

    // Level 2+: Scramble + Reveal 70%
    if (level >= 2) {
        // 1. Determine which indices are "exposed" letters
        // We want 66% of the letters to be real letters from the message
        const targetCount = Math.ceil(indices.length * GAME_CONFIG.PERCENT_REVEALED_SHUFFLE_HINT);

        // We already have index 0
        const pool = indices.filter(i => !revealedIndices.has(i));

        // Shuffle pool to pick random additional letters to reveal
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        // Add to revealed set until we reach target
        for (const idx of pool) {
            if (revealedIndices.size >= targetCount) break;
            revealedIndices.add(idx);
        }

        // 2. Construct the bag of characters
        const charBag: string[] = [];

        // Identify pinned index (First Letter) if applicable
        const pinnedIndex = (level >= 1 && indices.length > 0) ? indices[0] : -1;

        // Add the real letters (scrambled or not, they go into the bag)
        // EXCLUDE the pinned index from the bag
        revealedIndices.forEach(idx => {
            if (idx !== pinnedIndex) {
                charBag.push(content[idx]);
            }
        });

        // 3. Add special cipher characters for the remaining slots
        // Total slots needed = Total non-space chars - Revealed chars
        // Correction: Slots needed = (Total non-space chars) - (Pinned Chars) - (Chars in Bag)
        // Actually simpler: Total Bag Size must equal (Total Non-Space - Pinned Count)
        const pinnedCount = pinnedIndex !== -1 ? 1 : 0;
        const slotsNeeded = indices.length - pinnedCount - charBag.length;

        for (let i = 0; i < slotsNeeded; i++) {
            const c = CIPHER_SIGNS[Math.floor(Math.random() * CIPHER_SIGNS.length)];
            charBag.push(c);
        }

        // 4. Shuffle the bag (The "Scramble" effect)
        // User wants "Exposed letters have been shuffeled"
        for (let i = charBag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [charBag[i], charBag[j]] = [charBag[j], charBag[i]];
        }

        // 5. Reconstruct string, inserting spaces where they belong
        let result = '';
        let bagIndex = 0;
        for (let i = 0; i < length; i++) {
            if (content[i] === ' ') {
                result += ' ';
            } else if (i === pinnedIndex) {
                // Insert Pinned First Letter directly
                result += content[i];
            } else {
                result += charBag[bagIndex++] || '?';
            }
        }
        return result;
    }

    // Level 0 & 1 Logic (standard masking)
    let targetLen = length;
    if (level === 0 && !isDaily) {
        const minLen = Math.max(4, Math.floor(length / 2));
        const maxLen = Math.min(25, length * 2);
        targetLen = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;
    }

    // Ensure cipher length matches target for Level 1 match consistency
    if (level >= 1) targetLen = length;

    let result = '';
    for (let i = 0; i < targetLen; i++) {
        if (i < length && revealedIndices.has(i)) {
            result += content[i];
        } else {
            let randomChar;
            do {
                randomChar = CIPHER_SIGNS[Math.floor(Math.random() * CIPHER_SIGNS.length)];
            } while (i < length && randomChar === content[i]);
            result += randomChar;
        }
    }

    return result;
};

export const getRevealedCount = (content: string, level: number): number => {
    const nonSpaceCount = content.split('').filter(c => c !== ' ').length;
    if (nonSpaceCount === 0) return 0;

    let count = 0;
    // Level 1: Always reveals at least 1 (the first one)
    if (level >= 1) count = 1;

    // Level 2: Target is 40% of letters.
    // If 40% is less than 1 (e.g. short word), we stay at 1.
    // Logic matches generateCipherString: we ensure we have at least 'count' characters.
    if (level >= 2) {
        count = Math.max(count, Math.floor(nonSpaceCount * 0.4));
    }

    return count;
};

export const calculateRevealedPercentage = (content: string, guesses: string[]): number => {
    const indices: number[] = [];
    const length = content.length;
    for (let i = 0; i < length; i++) {
        if (content[i] !== ' ') {
            indices.push(i);
        }
    }

    if (indices.length === 0) return 0;

    const revealedCount = indices.filter(i => {
        const char = content[i].toLowerCase();
        // Green logic: correct position match (handled elsewhere usually, but here we just check if ANY guess exposes it)
        // Actually, CipherText logic says: "If you guessed a letter and it is in the target, show it orange everywhere it appears".
        // So checking if 'char' is in 'guesses' is sufficient for the "Orange" reveal logic which is the baseline.
        return guesses.some(g => g.toLowerCase().includes(char));
    }).length;

    return revealedCount / indices.length;
};

export const calculateNextTurnUserId = (players: { user_id: string }[], currentUserId: string): string | null => {
    if (!players || players.length === 0) return null;

    const currentIndex = players.findIndex(p => p.user_id === currentUserId);
    if (currentIndex === -1) return null;

    const nextIndex = (currentIndex + 1) % players.length;
    return players[nextIndex].user_id;
};

type SolvableMessage = {
    is_solved: boolean;
    strikes?: number | null;
};

/**
 * The word currently in play: the last one still unsolved and under the strike
 * limit. Both modes solve their chain backwards, hence the search from the end.
 *
 * Generic over the message shape so classic and daily can share one definition.
 */
export const findTargetMessage = <T extends SolvableMessage>(messages: T[]): T | undefined => {
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (!message.is_solved && (message.strikes || 0) < MAX_STRIKES) {
            return message;
        }
    }
    return undefined;
};
