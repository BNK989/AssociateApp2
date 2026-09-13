import { describe, expect, it } from 'vitest';
import { CIPHER_SIGNS } from '@/lib/gameConfig';
import {
    CLUE_SIGNS,
    DECODE_BUDGET_MS,
    GLYPHS_PER_CHAR,
    MAX_STEP_MS,
    MIN_STEP_MS,
    decodeStepMs,
    decodeSteps,
    maskWord,
    maskedLength,
    placeholderGlyphs,
    splitClue,
} from './clueDecode';

const GLYPHS = new Set(CLUE_SIGNS);

describe('decodeStepMs', () => {
    it('shares the budget out across the clue', () => {
        const length = 40;
        expect(decodeStepMs(length)).toBe(Math.round(DECODE_BUDGET_MS / length));
    });

    it('clamps a short clue so it still decodes rather than blinking in', () => {
        expect(decodeStepMs(4)).toBe(MAX_STEP_MS);
    });

    it('clamps a long clue so it never crawls', () => {
        expect(decodeStepMs(400)).toBe(MIN_STEP_MS);
    });

    it('survives an empty clue', () => {
        expect(decodeStepMs(0)).toBe(MAX_STEP_MS);
    });
});

describe('decodeSteps', () => {
    it('counts code points, so an astral character is one step and not two', () => {
        expect(decodeSteps('a 🜁 b')).toBe(5);
    });
});

describe('CLUE_SIGNS', () => {
    it('speaks the board alphabet, so the clue reads as part of the game', () => {
        for (const sign of CLUE_SIGNS) expect(CIPHER_SIGNS).toContain(sign);
    });

    it('is a single code point per sign, so a frame never slices a pair', () => {
        for (const sign of CLUE_SIGNS) expect(Array.from(sign)).toHaveLength(1);
    });
});

describe('splitClue', () => {
    const clue = 'A low, throaty sound.';

    it('puts the clue back together exactly', () => {
        expect(splitClue(clue).map((s) => s.text).join('')).toBe(clue);
    });

    it('separates maskable words from the punctuation that shapes the line', () => {
        expect(splitClue(clue).map((s) => `${s.kind}:${s.text}`)).toEqual([
            'word:A',
            'gap: ',
            'word:low',
            'gap:, ',
            'word:throaty',
            'gap: ',
            'word:sound',
            'gap:.',
        ]);
    });

    it('counts starts in code points, so a clue with an astral character lines up', () => {
        const segments = splitClue('a 🜁 b');

        expect(segments.map((s) => s.start)).toEqual([0, 1, 4]);
        expect(segments[2].text).toBe('b');
    });

    it('handles an empty clue', () => {
        expect(splitClue('')).toEqual([]);
    });
});

describe('maskedLength', () => {
    it('is shorter than what it hides, because a sign is wider than a letter', () => {
        expect(maskedLength(10)).toBeLessThan(10);
        expect(maskedLength(10)).toBe(Math.round(10 * GLYPHS_PER_CHAR));
    });

    it('never hides a character behind nothing at all', () => {
        expect(maskedLength(1)).toBe(1);
    });

    it('masks nothing once nothing is hidden', () => {
        expect(maskedLength(0)).toBe(0);
        expect(maskedLength(-3)).toBe(0);
    });
});

describe('maskWord', () => {
    it('reads plainly once the word is fully revealed', () => {
        expect(maskWord('throaty', 7, 0)).toBe('throaty');
        expect(maskWord('throaty', 99, 3)).toBe('throaty');
    });

    it('masks the whole word while nothing is revealed', () => {
        const masked = Array.from(maskWord('throaty', 0, 0));

        expect(masked).toHaveLength(maskedLength(7));
        for (const char of masked) expect(GLYPHS.has(char)).toBe(true);
    });

    it('decodes from the start, masking only what is left', () => {
        const partial = maskWord('throaty', 3, 0);

        expect(partial.startsWith('thr')).toBe(true);
        expect(Array.from(partial.slice(3))).toHaveLength(maskedLength(4));
    });

    it('stays the width of the word it hides, at every step of the decode', () => {
        // In letter-widths: a decoded character is one, a sign is one divided
        // by the ratio (about 1.7). The old mask was a sign per character, so
        // a fully masked clue ran 1.7x wide and shed that width as it decoded.
        const word = 'throaty';
        const letters = word.length;

        for (let revealed = 0; revealed <= letters; revealed += 1) {
            const signs = maskedLength(letters - revealed);
            const width = revealed + signs / GLYPHS_PER_CHAR;

            expect(Math.abs(width - letters)).toBeLessThan(1);
        }
    });

    it('is deterministic, so a re-render mid-decode shows the same frame', () => {
        expect(maskWord('sound', 2, 9, 15)).toBe(maskWord('sound', 2, 9, 15));
    });

    it('churns the masked tail between frames', () => {
        expect(maskWord('throaty', 0, 0)).not.toBe(maskWord('throaty', 0, 1));
    });

    it('gives two identical words different masks, from their place in the clue', () => {
        expect(maskWord('sound', 0, 0, 0)).not.toBe(maskWord('sound', 0, 0, 3));
    });

    it('handles an empty word', () => {
        expect(maskWord('', 0, 0)).toBe('');
    });
});

describe('placeholderGlyphs', () => {
    it('stands in for a clue that has not arrived', () => {
        const glyphs = Array.from(placeholderGlyphs(12, 2));

        expect(glyphs).toHaveLength(12);
        for (const char of glyphs) expect(GLYPHS.has(char)).toBe(true);
    });
});
