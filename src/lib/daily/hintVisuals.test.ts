import { describe, expect, it } from 'vitest';
import { MAX_HINT_LEVEL } from '@/lib/gameConfig';
import { hintLevelUpdates } from './hintVisuals';

const WORD = 'Conductor';

describe('hintLevelUpdates', () => {
    it('records the level it was asked for', () => {
        expect(hintLevelUpdates({ word: WORD, currentLevel: 0, nextLevel: 1 }).hint_level).toBe(1);
    });

    // Cipher glyphs are astral-plane characters, so the mask is counted by code
    // point rather than by `.length`.
    it('generates a mask one glyph per letter of the word', () => {
        const { cipher_text } = hintLevelUpdates({ word: WORD, currentLevel: 0, nextLevel: 1 });
        expect([...cipher_text]).toHaveLength(WORD.length);
    });

    it('exposes the first letter from level 1', () => {
        const { cipher_text } = hintLevelUpdates({ word: WORD, currentLevel: 0, nextLevel: 1 });
        expect(cipher_text[0]).toBe('C');
    });

    // The clue sits on top of the level-2 scramble, so a player who skipped
    // straight to it still needs that scramble generated underneath.
    it('builds the scramble when the clue is reached from below level 2', () => {
        const { cipher_text } = hintLevelUpdates({
            word: WORD,
            currentLevel: 0,
            nextLevel: MAX_HINT_LEVEL,
            currentCipher: '?????????',
            clue: 'Leads an orchestra',
        });

        expect(cipher_text).not.toBe('?????????');
        expect(cipher_text[0]).toBe('C');
    });

    // Re-shuffling a mask the player has been staring at reads as the word
    // changing rather than as a hint arriving.
    it('keeps the existing mask when the clue is reached from level 2', () => {
        const scramble = 'Cotcudnor';
        const { cipher_text } = hintLevelUpdates({
            word: WORD,
            currentLevel: 2,
            nextLevel: MAX_HINT_LEVEL,
            currentCipher: scramble,
            clue: 'Leads an orchestra',
        });

        expect(cipher_text).toBe(scramble);
    });

    it('falls back to a fresh scramble when there is no mask to keep', () => {
        const { cipher_text } = hintLevelUpdates({
            word: WORD,
            currentLevel: 2,
            nextLevel: MAX_HINT_LEVEL,
            clue: 'Leads an orchestra',
        });

        expect([...cipher_text]).toHaveLength(WORD.length);
    });

    it('attaches the clue only at the top of the ladder', () => {
        const clue = 'Leads an orchestra';

        expect(hintLevelUpdates({ word: WORD, currentLevel: 0, nextLevel: 1, clue }).ai_hint)
            .toBeUndefined();
        expect(hintLevelUpdates({ word: WORD, currentLevel: 2, nextLevel: MAX_HINT_LEVEL, clue }).ai_hint)
            .toBe(clue);
    });

    it('omits the clue field entirely when none was supplied', () => {
        const updates = hintLevelUpdates({ word: WORD, currentLevel: 2, nextLevel: MAX_HINT_LEVEL });
        expect('ai_hint' in updates).toBe(false);
    });
});
