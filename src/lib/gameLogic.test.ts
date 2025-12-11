import { describe, it, expect } from 'vitest';
import {
    calculateMessageValue,
    calculateSimilarity,
    generateCipherString
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

        it('should return fully ciphered string at level 0', () => {
            const cipher = generateCipherString(input, 0);
            expect(cipher).not.toBe(input);
            expect(cipher.length).toBe(input.length);
            // Ensure it's not the same as input
            expect(cipher).not.toBe(input);
        });

        it('should return first letter at level 1', () => {
            const cipher = generateCipherString(input, 1);
            expect(cipher[0]).toBe('H');
            expect(cipher).not.toBe(input);
        });

        it('should return 50% revealed at level 2', () => {
            const cipher = generateCipherString("AAAAA AAAAA", 2);
            // Roughly half should be A's (excluding spaces)
            const revealedCount = (cipher.match(/A/g) || []).length;
            expect(revealedCount).toBeGreaterThan(0);
            expect(revealedCount).toBeLessThan(10);
        });

        it('should preserve spaces', () => {
            const cipher = generateCipherString("a b c", 0);
            expect(cipher[1]).toBe(' ');
            expect(cipher[3]).toBe(' ');
        });
    });
});
