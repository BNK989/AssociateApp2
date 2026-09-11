import { describe, expect, it } from 'vitest';
import { calculateSimilarity, isCorrectAnswer, normaliseAnswer } from '@/lib/gameLogic';
import { stripSuppliesShape } from './poolRules';

describe('stripSuppliesShape', () => {
    it('is on for the whole of a single-player word', () => {
        expect(stripSuppliesShape({ enabled: true, hintLevel: 0, isSinglePlayer: true })).toBe(true);
    });

    it('waits for the first hint in a multiplayer room', () => {
        expect(stripSuppliesShape({ enabled: true, hintLevel: 0, isSinglePlayer: false })).toBe(false);
        expect(stripSuppliesShape({ enabled: true, hintLevel: 1, isSinglePlayer: false })).toBe(true);
    });

    it('is off entirely when the pool is disabled', () => {
        expect(stripSuppliesShape({ enabled: false, hintLevel: 3, isSinglePlayer: true })).toBe(false);
    });
});

describe('normaliseAnswer', () => {
    it('folds case', () => {
        expect(normaliseAnswer('Harmony')).toBe('harmony');
    });

    it('folds diacritics, which a phone keyboard will often not produce', () => {
        expect(normaliseAnswer('café')).toBe(normaliseAnswer('cafe'));
        expect(normaliseAnswer('Măr')).toBe(normaliseAnswer('mar'));
    });

    it('collapses whitespace so a phrase is compared by its words', () => {
        expect(normaliseAnswer('  morning   glory ')).toBe('morning glory');
    });
});

describe('isCorrectAnswer — the strip makes fuzzy matching unsafe', () => {
    // The defect this exists to stop. The strip fills confirmed letters in for
    // the player, so a fuzzy threshold counts letters they did not write.
    it('rejects a wrong last letter that fuzzy matching would have passed', () => {
        // Six of seven letters right scores 0.857, over the 0.8 threshold.
        expect(calculateSimilarity('harmonx', 'harmony')).toBeGreaterThan(0.8);
        expect(isCorrectAnswer('harmonx', 'harmony', { exact: true })).toBe(false);
    });

    it('still accepts the right answer', () => {
        expect(isCorrectAnswer('harmony', 'Harmony', { exact: true })).toBe(true);
    });

    it('accepts an answer typed without its accents', () => {
        expect(isCorrectAnswer('melodie', 'mélodie', { exact: true })).toBe(true);
    });

    it('accepts a phrase however it was spaced', () => {
        expect(isCorrectAnswer('morning  glory', 'Morning Glory', { exact: true })).toBe(true);
    });

    it('keeps forgiving a typo where the player typed the word themselves', () => {
        // Free text, no strip: fuzziness is doing the job it was written for.
        expect(isCorrectAnswer('harmonx', 'harmony', { exact: false })).toBe(true);
    });

    it('rejects a genuinely different word in either mode', () => {
        for (const exact of [true, false]) {
            expect(isCorrectAnswer('melody', 'harmony', { exact })).toBe(false);
        }
    });
});
