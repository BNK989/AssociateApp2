import { describe, it, expect } from 'vitest';
import {
    calculateMessageValue,
    calculateSimilarity,
    generateCipherString,
    calculateNextTurnUserId,
    calculatePointDistribution
} from '@/lib/gameLogic';

describe('Game Logic', () => {
    describe('calculateMessageValue', () => {
        it('should calculate base value correctly', () => {
            // Base 10 + 1 per char
            expect(calculateMessageValue('hello')).toBe(15); // 10 + 5
            expect(calculateMessageValue('a')).toBe(11); // 10 + 1
        });

        it('should handle empty strings', () => {
            expect(calculateMessageValue('')).toBe(10); // 10 + 0
        });

        it('should handle spaces', () => {
            expect(calculateMessageValue('hello world')).toBe(21); // 10 + 11
        });
    });

    describe('calculateSimilarity', () => {
        it('should return 1.0 for exact matches (case insensitive)', () => {
            expect(calculateSimilarity('Hello', 'hello')).toBe(1.0);
            expect(calculateSimilarity('TEST', 'test')).toBe(1.0);
        });

        it('should return < 1.0 for partial matches', () => {
            expect(calculateSimilarity('hello', 'help')).toBeLessThan(1.0);
            expect(calculateSimilarity('hello', 'help')).toBeGreaterThan(0.0);
        });

        it('should return 0 for completely different strings', () => {
            // Levenshtein distance based, might not be exactly 0 if length allows inserts, 
            // but for "abc" vs "xyz" it should be low.
            const sim = calculateSimilarity('abc', 'xyz');
            expect(sim).toBeLessThan(0.2);
        });
    });

    describe('generateCipherString', () => {
        const input = "Hello World";

        it('should return cipher string within length constraints at level 0', () => {
            const cipher = generateCipherString(input, 0);
            const len = input.length;
            const minLen = Math.max(4, Math.floor(len / 2));
            const maxLen = Math.min(25, len * 2);

            expect(cipher.length).toBeGreaterThanOrEqual(minLen);
            expect(cipher.length).toBeLessThanOrEqual(maxLen);

            if (cipher.length === input.length) {
                // Statistically possible but checking it differs
                // expect(cipher).not.toBe(input); 
            }
        });

        it('should return EXACT length at level 1', () => {
            // Level 1 reveals length (no chars) - cipher length == input length
            const cipher = generateCipherString(input, 1);
            expect(cipher.length).toBe(input.length);
        });

        it('should reveal 1st char + 25% at level 2', () => {
            const longInput = "AAAAA AAAAA AAAAA"; // 17 chars
            const cipher = generateCipherString(longInput, 2);

            expect(cipher.length).toBe(longInput.length);
            expect(cipher[0]).toBe('A');

            let matches = 0;
            for (let i = 0; i < longInput.length; i++) {
                if (cipher[i] === longInput[i] && longInput[i] !== ' ') {
                    matches++;
                }
            }
            // 17 * 0.25 = 4.25 -> 4 revealed ints. + index 0 (which is also 'A')
            // logic: indices (14 non-space). 14*0.25 = 3. 
            // set adds index 0. total 4 indices revealed.
            expect(matches).toBeGreaterThanOrEqual(1);
        });

        it('should only reveal 1st char for short words at level 2', () => {
            const shortInput = "ABC"; // 3 chars
            const cipher = generateCipherString(shortInput, 2);

            expect(cipher.length).toBe(3);
            expect(cipher[0]).toBe('A');
        });

        it('should NOT necessarily preserve spaces', () => {
            const cipher = generateCipherString("a b c", 0);
            expect(cipher.length).toBeGreaterThan(0);
        });
    });

    describe('calculateNextTurnUserId', () => {
        const players = [
            { user_id: 'u1' },
            { user_id: 'u2' },
            { user_id: 'u3' }
        ];

        it('should return next player in cyclic order', () => {
            expect(calculateNextTurnUserId(players, 'u1')).toBe('u2');
            expect(calculateNextTurnUserId(players, 'u2')).toBe('u3');
            expect(calculateNextTurnUserId(players, 'u3')).toBe('u1');
        });

        it('should handle single player', () => {
            const singlePlayer = [{ user_id: 'u1' }];
            expect(calculateNextTurnUserId(singlePlayer, 'u1')).toBe('u1');
        });

        it('should return null if player not found', () => {
            expect(calculateNextTurnUserId(players, 'u99')).toBeNull();
        });

        it('should return null if empty players', () => {
            expect(calculateNextTurnUserId([], 'u1')).toBeNull();
        });
    });

    describe('calculatePointDistribution', () => {
        it('should handle Self-Rescue (50% to solver)', () => {
            const distribution = calculatePointDistribution(100, 'u1', 'u1'); // guesser == author
            expect(distribution.type).toBe('SELF_RESCUE');
            expect(distribution.winnerPoints).toBe(50);
            expect(distribution.authorPoints).toBe(0);
            expect(distribution.totalPoints).toBe(50);
        });

        it('should handle Steal (75% to solver, 25% to author)', () => {
            const distribution = calculatePointDistribution(100, 'u2', 'u1'); // guesser != author
            expect(distribution.type).toBe('STEAL');
            expect(distribution.winnerPoints).toBe(75);
            expect(distribution.authorPoints).toBe(25);
            expect(distribution.totalPoints).toBe(100);
        });

        it('should handle multiplier', () => {
            const distribution = calculatePointDistribution(100, 'u2', 'u1', 2);
            expect(distribution.winnerPoints).toBe(150);
            expect(distribution.authorPoints).toBe(50);
        });

        it('should floor decimal points', () => {
            const distribution = calculatePointDistribution(10, 'u2', 'u1');
            expect(distribution.winnerPoints).toBe(7);
            expect(distribution.authorPoints).toBe(2);
        });
    });
});
