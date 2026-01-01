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

export const generateCipherString = (content: string, level: number, isDaily: boolean = false): string => {
    const length = content.length;

    // Calculate indices for non-space characters (candidates for hints)
    const indices: number[] = [];
    for (let i = 0; i < length; i++) {
        if (content[i] !== ' ') {
            indices.push(i);
        }
    }

    const revealedIndices = new Set<number>();

    // Level 1+: Reveal First Letter
    if (level >= 1 && indices.length > 0) {
        revealedIndices.add(indices[0]);
    }

    // Level 2+: Scramble + Reveal 70%
    // Logic: 
    // 1. Pick 70% of real charecters (must include index 0).
    // 2. Fill rest with random chars.
    // 3. Shuffle ONLY the positions, keeping spaces? 
    // Actually, "scramble message letters" usually implies word structure might be lost or just letters jumbled.
    // To fit existing UI simple string mapping, we'll just generate a string of length N.
    // It will contain the chosen real letters and fillers, randomized.

    if (level >= 2) {
        // 1. Gather Real Chars to Reveal
        const realCharIndices = new Set<number>();
        if (indices.length > 0) realCharIndices.add(indices[0]); // Always include first letter

        // Add more to reach 70%
        const targetCount = Math.floor(indices.length * 0.70);
        const pool = indices.filter(i => !realCharIndices.has(i));

        // Shuffle pool to pick random additional letters
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        for (const idx of pool) {
            if (realCharIndices.size >= targetCount) break;
            realCharIndices.add(idx);
        }

        // 2. Construct the bag of characters
        const charBag: string[] = [];

        // Add real chars
        realCharIndices.forEach(idx => charBag.push(content[idx]));

        // Add random fillers for the rest of path (excluding spaces which we might just preserve or also fill?)
        // If we want to preserve message LENGTH and Space structure?
        // "Review" -> "Rsvie@" (6 chars).
        // If we have spaces "Hello World" -> "Hlool Wrld"?
        // Usually hints preserve space structure to help guessing length.
        // Let's preserve Spaces in their original positions, and scramble only the letters within the word?
        // Or just scramble everything?
        // "Scrumble the message letters" -> implies anagram.
        // Let's try to preserve spaces for readability of word count, but scramble letters globally? 
        // Or scramble per word?
        // Simplest Global Scramble of letters, keeping spaces fixed.

        const spaceIndices = new Set<number>();
        for (let i = 0; i < length; i++) {
            if (content[i] === ' ') spaceIndices.add(i);
        }

        const slotsNeeded = length - spaceIndices.size - charBag.length;
        for (let i = 0; i < slotsNeeded; i++) {
            // Pick random char that is NOT in content? Or just random.
            // To make "real" letters distinct in UI, better if filler doesn't match content.
            let c;
            let attempts = 0;
            do {
                c = CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
                attempts++;
            } while (content.includes(c) && attempts < 5); // Try to avoid valid chars
            charBag.push(c);
        }

        // 3. Shuffle the bag
        for (let i = charBag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [charBag[i], charBag[j]] = [charBag[j], charBag[i]];
        }

        // 4. Reconstruct string, inserting spaces where they belong
        let result = '';
        let bagIndex = 0;
        for (let i = 0; i < length; i++) {
            if (content[i] === ' ') {
                result += ' ';
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

    // Re-verify exact length for Level 1 or Daily
    // If we passed the level >= 2 block, we are here for Level 0 or 1.
    // Ensure we respect revealed indices from Level 1 block up top.

    let result = '';
    // Fix: revealedIndices only populated for Level 1 above now (removed Level 2 block there)

    // Ensure cipher length matches target for Level 1 match consistency
    if (level >= 1) targetLen = length;

    // Handle length mismatch for Level 0 randomization
    // If targetLen > length, we pad. If < length, we truncate?
    // Actually generateCipherString just produces a string.

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
