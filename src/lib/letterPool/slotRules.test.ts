import { describe, expect, it } from 'vitest';
import { CIPHER_SIGNS } from '@/lib/gameConfig';
import { resolveTyping, typeableCapacity } from './slotRules';

const read = (text: string, guesses: string[], typed: string, mode: 'skip' | 'full' = 'skip') =>
    resolveTyping({ text, guesses, typed, mode });

/** A hint-1 mask: all filler, so only the first-letter guarantee gives anything. */
const firstLetterBought = (text: string) => ({
    cipher: CIPHER_SIGNS[0].repeat([...text].length),
    hintLevel: 1,
});

const readWithHint = (text: string, typed: string) =>
    resolveTyping({ text, guesses: [], typed, mode: 'skip', mask: firstLetterBought(text) });

describe('typeableCapacity', () => {
    it('counts every slot the player could type into', () => {
        expect(typeableCapacity('Harmony')).toBe(7);
    });

    it('leaves out the scenery the strip supplies', () => {
        expect(typeableCapacity('morning glory')).toBe(12);
        expect(typeableCapacity("o'clock")).toBe(6);
    });
});

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

describe('resolveTyping — a repeated first letter, where neither reading dies early', () => {
    // 'o' is both the given letter and the next letter, so nothing rules either
    // reading out until the strip is full. Length is what settles it.
    it('reads OOZE typed in full', () => {
        expect(readWithHint('Ooze', 'ooze').attempt).toBe('Ooze');
    });

    it('reads OOZE typed as gaps', () => {
        expect(readWithHint('Ooze', 'oze').attempt).toBe('Ooze');
    });

    it('reads LLAMA typed in full', () => {
        expect(readWithHint('Llama', 'llama').attempt).toBe('Llama');
    });

    it('reads LLAMA typed as gaps', () => {
        expect(readWithHint('Llama', 'lama').attempt).toBe('Llama');
    });

    it('settles on the reading that fills the strip, not the one it guessed first', () => {
        // Mid-word both survive and `whole` is preferred; `oze` only becomes
        // the gaps reading once it is long enough to finish the word.
        expect(readWithHint('Ooze', 'o').reading).toBe('whole');
        expect(readWithHint('Ooze', 'oze').reading).toBe('gaps');
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
