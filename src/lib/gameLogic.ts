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

export const HINT_COSTS = {
    TIER_1: 0.10, // 10%
    TIER_2: 0.10, // Another 10%
    TIER_3: 0.40  // 40%
};

const CIPHER_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

export const generateCipherString = (content: string, level: number): string => {
    const length = content.length;

    // Calculate indices for non-space characters (candidates for hints)
    const indices: number[] = [];
    for (let i = 0; i < length; i++) {
        if (content[i] !== ' ') {
            indices.push(i);
        }
    }

    const revealedIndices = new Set<number>();

    // Level 2+: Reveal First Letter + 25%
    if (level >= 2 && indices.length > 0) {
        // Always reveal first char
        revealedIndices.add(indices[0]);

        if (indices.length >= 4) {
            const countToReveal = Math.floor(indices.length * 0.25);
            const remainingIndices = indices.filter(idx => !revealedIndices.has(idx));

            // Shuffle (Fisher-Yates)
            for (let i = remainingIndices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [remainingIndices[i], remainingIndices[j]] = [remainingIndices[j], remainingIndices[i]];
            }

            const needed = Math.max(0, countToReveal);
            for (let i = 0; i < needed && i < remainingIndices.length; i++) {
                revealedIndices.add(remainingIndices[i]);
            }
        }
        // If < 4 chars, we only revealed the first one (indices[0]), which is correct per requirements.
    }

    // Determine Cipher Length
    // Level 0: Random length (0.5x - 2x, min 4, max 25)
    // Level 1+: Exact length

    let targetLen = length; // Default for Level 1+

    if (level === 0) {
        const minLen = Math.max(4, Math.floor(length / 2));
        const maxLen = Math.min(25, length * 2);
        targetLen = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;
    }

    // Ensure cipher is long enough (mostly for Level 0)
    if (revealedIndices.size > 0) {
        const maxRevealedIndex = Math.max(...Array.from(revealedIndices));
        if (targetLen <= maxRevealedIndex) {
            targetLen = maxRevealedIndex + 1;
        }
    }

    let result = '';
    for (let i = 0; i < targetLen; i++) {
        if (i < length && revealedIndices.has(i)) {
            result += content[i];
        } else {
            let randomChar;
            do {
                randomChar = CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
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

export const calculateNextTurnUserId = (players: { user_id: string }[], currentUserId: string): string | null => {
    if (!players || players.length === 0) return null;

    const currentIndex = players.findIndex(p => p.user_id === currentUserId);
    if (currentIndex === -1) return null;

    const nextIndex = (currentIndex + 1) % players.length;
    return players[nextIndex].user_id;
};
