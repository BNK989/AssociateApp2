import { describe, expect, it } from 'vitest';
import { CIPHER_SIGNS } from '@/lib/gameConfig';
import {
    DECODE_BUDGET_MS,
    MAX_STEP_MS,
    MIN_STEP_MS,
    decodeFrame,
    decodeStepMs,
    decodeSteps,
    placeholderGlyphs,
} from './clueDecode';

const GLYPHS = new Set(CIPHER_SIGNS);

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

describe('decodeFrame', () => {
    const clue = 'A low, throaty sound.';

    it('reads plainly once every character is revealed', () => {
        expect(decodeFrame(clue, decodeSteps(clue), 0)).toBe(clue);
    });

    it('masks every letter and digit while nothing is revealed', () => {
        const masked = Array.from(decodeFrame('ab 7c', 0, 0));

        expect(masked).toHaveLength(5);
        expect(masked[2]).toBe(' ');
        for (const i of [0, 1, 3, 4]) expect(GLYPHS.has(masked[i])).toBe(true);
    });

    it('keeps spaces and punctuation, so the line does not reflow as it decodes', () => {
        const masked = Array.from(decodeFrame(clue, 0, 3));

        expect(masked).toHaveLength(clue.length);
        for (let i = 0; i < clue.length; i += 1) {
            if (/[\s,.]/.test(clue[i])) expect(masked[i]).toBe(clue[i]);
        }
    });

    it('decodes from the start, leaving the tail masked', () => {
        const partial = decodeFrame(clue, 5, 0);

        expect(partial.startsWith('A low')).toBe(true);
        expect(partial.slice(6)).not.toBe(clue.slice(6));
    });

    it('is deterministic, so a re-render mid-decode shows the same frame', () => {
        expect(decodeFrame(clue, 4, 9)).toBe(decodeFrame(clue, 4, 9));
    });

    it('churns the masked tail between frames', () => {
        expect(decodeFrame(clue, 0, 0)).not.toBe(decodeFrame(clue, 0, 1));
    });

    it('handles an empty clue', () => {
        expect(decodeFrame('', 0, 0)).toBe('');
    });
});

describe('placeholderGlyphs', () => {
    it('stands in for a clue that has not arrived', () => {
        const glyphs = Array.from(placeholderGlyphs(12, 2));

        expect(glyphs).toHaveLength(12);
        for (const char of glyphs) expect(GLYPHS.has(char)).toBe(true);
    });
});
