import { describe, expect, it } from 'vitest';
import { CIPHER_SIGNS } from '@/lib/gameConfig';
import { resolveTyping } from './readingRules';

const read = (text: string, guesses: string[], typed: string, mode: 'skip' | 'full' = 'skip') =>
    resolveTyping({ text, guesses, typed, mode });

/** A hint-1 mask: all filler, so only the first-letter guarantee gives anything. */
const firstLetterBought = (text: string) => ({
    cipher: CIPHER_SIGNS[0].repeat([...text].length),
    hintLevel: 1,
});

const readWithHint = (text: string, typed: string) =>
    resolveTyping({ text, guesses: [], typed, mode: 'skip', mask: firstLetterBought(text) });

describe('resolveTyping — both habits reach the same answer', () => {
    // SAMPLE with S and M confirmed, which is the case that prompted this:
    // the player should be able to type the word out rather than the gaps.
    // Confirms S at 0 and M at 2, and nothing else.
    const sample = ['sxxxxx', 'xxmxxx'];

    it('reads the whole word when it is typed in full', () => {
        const typing = read('sample', sample, 'sample');
        expect(typing.reading).toBe('whole');
        expect(typing.attempt).toBe('sample');
    });

    it('reads the gaps when only the gaps are typed', () => {
        const typing = read('sample', sample, 'aple');
        expect(typing.reading).toBe('gaps');
        expect(typing.attempt).toBe('sample');
    });

    it('reaches the same answer either way', () => {
        expect(read('sample', sample, 'sample').attempt)
            .toBe(read('sample', sample, 'aple').attempt);
    });
});

describe('resolveTyping — the reading holds while it is still possible', () => {
    // PULLEY with P, U and Y confirmed: three given letters, three open slots,
    // so the third keystroke of `pulley` fills the strip under the gaps reading
    // while the whole-word reading is only half typed. The strip used to jump
    // to PUPULY there — every letter but the typed one moving, mid-word, on a
    // correct keystroke. Reported from production, 2026-09-13.
    const pulley = ['puxxxy'];
    const strip = (typed: string) =>
        read('pulley', pulley, typed).slots.map((slot) => slot.char ?? '_').join('');

    it('keeps the whole word through the keystroke that would fill the gaps', () => {
        expect(read('pulley', pulley, 'pul').reading).toBe('whole');
        expect(strip('pul')).toBe('pul__y');
    });

    it('never re-arranges what is already on the strip while typing it out', () => {
        const seen = ['p', 'pu', 'pul', 'pull', 'pulle', 'pulley'].map(strip);
        expect(seen).toEqual(['pu___y', 'pu___y', 'pul__y', 'pull_y', 'pulley', 'pulley']);
    });

    it('shows a typo where it was typed rather than re-reading the word', () => {
        // The screenshot in the report: `pug` came back as PUPUGY.
        expect(strip('pug')).toBe('pug__y');
    });

    it('still reads the gaps when the gaps are what was typed', () => {
        expect(read('pulley', pulley, 'lle').reading).toBe('gaps');
        expect(read('pulley', pulley, 'lle').attempt).toBe('pulley');
    });

    it('holds through the same keystroke when the given letters are scattered', () => {
        // Every 'a' of BANANA is confirmed: three given, three open.
        expect(read('banana', ['xaxaxa'], 'ban').reading).toBe('whole');
    });
});

describe('resolveTyping — a repeated first letter, where neither reading dies early', () => {
    // 'o' is both the given letter and the next letter, so nothing rules either
    // reading out. The whole-word reading is the one that holds.
    it('reads OOZE typed in full', () => {
        expect(readWithHint('Ooze', 'ooze').attempt).toBe('Ooze');
    });

    it('reads LLAMA typed in full', () => {
        expect(readWithHint('Llama', 'llama').attempt).toBe('Llama');
    });

    it('leaves a skipped doubled first letter one cell short', () => {
        // The rough edge, stated in `resolveTyping`: `oze` is a finished gaps
        // reading and an unfinished whole-word one, and nothing the player can
        // see separates them. Holding the reading costs this case a dead end —
        // visible, and backed out of by clearing the field — rather than
        // costing every player who types a word out in full a jumping strip.
        expect(readWithHint('Ooze', 'oze').reading).toBe('whole');
        expect(readWithHint('Ooze', 'oze').attempt).toBeNull();
        expect(readWithHint('Llama', 'lama').attempt).toBeNull();
    });

    it('prefers the whole word from the first keystroke', () => {
        expect(readWithHint('Ooze', 'o').reading).toBe('whole');
    });
});

describe('resolveTyping — while the answer is unfinished', () => {
    const guesses = ['harpoon'];

    it('prefers the whole word once a given letter has been matched', () => {
        // 'h' is the confirmed first letter, so this is most likely someone
        // typing the answer out rather than starting at the gaps.
        expect(read('Harmony', guesses, 'h').reading).toBe('whole');
    });

    it('falls to the gaps as soon as the whole word disagrees', () => {
        expect(read('Harmony', guesses, 'm').reading).toBe('gaps');
    });

    it('puts the caret on the first empty cell', () => {
        // H A R _ O _ _ — the first gap is index 3.
        expect(read('Harmony', guesses, '').caretIndex).toBe(3);
    });

    it('has no caret once every cell is filled', () => {
        expect(read('Harmony', guesses, 'harmony').caretIndex).toBeNull();
    });

    it('reports no attempt while a cell is empty', () => {
        expect(read('Harmony', guesses, 'mn').attempt).toBeNull();
    });
});

describe('resolveTyping — repeated letters elsewhere in the word', () => {
    // Every 'a' of BANANA is confirmed; b, n, n are not.
    const guesses = ['xaxaxa'];

    it('reads it typed in full', () => {
        expect(read('banana', guesses, 'banana').attempt).toBe('banana');
    });

    it('reads it typed as gaps', () => {
        expect(read('banana', guesses, 'bnn').attempt).toBe('banana');
    });
});

describe('resolveTyping — when neither reading works', () => {
    // A typo over a confirmed letter: too long for the gaps, and it disagrees
    // with the letter it lands on.
    it('shows the whole-word reading so the mistake is visible', () => {
        const typing = read('sample', ['sxxxxx', 'xxmxxx'], 'sapple');
        expect(typing.reading).toBe('whole');
        expect(typing.slots.some((slot) => slot.conflict)).toBe(true);
    });
});

describe('resolveTyping — pinned to the whole word by the game master', () => {
    it('never reads the gaps, whatever was typed', () => {
        const typing = read('Harmony', ['harpoon'], 'mny', 'full');
        expect(typing.reading).toBe('whole');
        expect(typing.slots.some((slot) => slot.conflict)).toBe(true);
    });
});
