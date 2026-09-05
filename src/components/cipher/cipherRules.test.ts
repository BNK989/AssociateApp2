import { describe, it, expect } from 'vitest';
import {
    buildRandomCipher,
    buildScrambleItems,
    computeGuessState,
    findNewlyRevealedIndices,
    generateShuffledView,
    isFillerChar,
    readMaskTile,
    type ScrambleItem,
} from './cipherRules';
import { CIPHER_SIGNS } from '@/lib/gameConfig';

const FILLER = '#';
const build = (text: string, cipher: string, guesses: string[] = [], hintLevel = 0) =>
    buildScrambleItems({
        textChars: [...text],
        cipherChars: [...cipher],
        guessState: computeGuessState(text, guesses),
        hintLevel,
        pickFiller: () => FILLER,
    });

describe('buildRandomCipher', () => {
    it('matches the source length in code points', () => {
        expect([...buildRandomCipher('Harmony')]).toHaveLength(7);
    });

    it('preserves spaces in place', () => {
        const cipher = buildRandomCipher('a b');
        expect(cipher[1]).toBe(' ');
    });

    it('never leaves a character equal to the one it masks', () => {
        const text = 'Harmony Chord';
        for (let attempt = 0; attempt < 50; attempt++) {
            const cipher = [...buildRandomCipher(text)];
            [...text].forEach((char, i) => {
                if (char !== ' ') expect(cipher[i]).not.toBe(char);
            });
        }
    });
});

describe('computeGuessState', () => {
    it('marks a correctly placed letter green', () => {
        // 'harpoon' aligns h-a-r with Harmony, and also 'o' at index 4.
        const { greenIndices } = computeGuessState('Harmony', ['harpoon']);
        expect([...greenIndices].sort((a, b) => a - b)).toEqual([0, 1, 2, 4]);
    });

    it('marks letters known to be present, wherever they sit', () => {
        const { revealedChars } = computeGuessState('Harmony', ['xxxxxny']);
        expect(revealedChars.has('n')).toBe(true);
        expect(revealedChars.has('y')).toBe(true);
    });

    it('does not reveal letters absent from the answer', () => {
        const { revealedChars } = computeGuessState('Harmony', ['zzzz']);
        expect(revealedChars.has('z')).toBe(false);
    });

    it('is case-insensitive', () => {
        expect(computeGuessState('Harmony', ['HAR']).greenIndices.size).toBe(3);
    });

    it('accumulates across several guesses', () => {
        const { greenIndices } = computeGuessState('Harmony', ['hxxxxxx', 'xxxxxxy']);
        expect(greenIndices.has(0)).toBe(true);
        expect(greenIndices.has(6)).toBe(true);
    });

    it('ignores a guess longer than the answer', () => {
        expect(() => computeGuessState('ab', ['abcdef'])).not.toThrow();
        expect(computeGuessState('ab', ['abcdef']).greenIndices.size).toBe(2);
    });

    it('returns nothing for no guesses', () => {
        const state = computeGuessState('Harmony', []);
        expect(state.greenIndices.size).toBe(0);
        expect(state.revealedChars.size).toBe(0);
    });
});

describe('buildScrambleItems — the letter budget', () => {
    it('never shows more of a letter than the answer contains', () => {
        // The answer has one 'o'; the mask offers three.
        const items = build('Chord', 'ooooo');
        const visibleOs = items.filter((i) => i.char.toLowerCase() === 'o').length;
        expect(visibleOs).toBe(1);
    });

    it('replaces an over-budget letter with filler rather than dropping it', () => {
        const items = build('Chord', 'ooooo');
        expect(items).toHaveLength(5);
        expect(items.filter((i) => i.char === FILLER)).toHaveLength(4);
    });

    it('spends the budget on greens before the mask', () => {
        // 'o' is already earned at its own position, so the mask gets none.
        const items = build('Chord', 'ooooo', ['xxoxx']);
        const realOs = items.filter((i) => i.char.toLowerCase() === 'o' && i.isReal);
        expect(realOs).toHaveLength(1);
        expect(realOs[0].locked).toBe(true);
    });

    it('allows a mask letter the answer genuinely has spare', () => {
        // Two 'l's in the answer, one offered by the mask, none yet earned.
        const items = build('Hello', '###l#');
        expect(items[3].char.toLowerCase()).toBe('l');
        expect(items[3].isReal).toBe(true);
    });

    it('leaves filler symbols in the mask untouched', () => {
        const items = build('Chord', '~~~~~');
        expect(items.every((i) => i.char === '~')).toBe(true);
        expect(items.every((i) => !i.isReal)).toBe(true);
    });

    it('keeps a mask character that is not an answer letter', () => {
        const items = build('Chord', 'zzzzz');
        expect(items.every((i) => i.char === 'z')).toBe(true);
        expect(items.every((i) => !i.isReal)).toBe(true);
    });
});

describe('buildScrambleItems — earned letters', () => {
    it('pins greens in place and marks them real', () => {
        const items = build('Harmony', '#######', ['har']);
        for (const i of [0, 1, 2]) {
            expect(items[i].char).toBe('Harmony'[i]);
            expect(items[i].isReal).toBe(true);
            expect(items[i].locked).toBe(true);
        }
    });

    it('shows oranges as real but leaves them free to move', () => {
        // 'y' is in the answer but guessed only in the wrong place.
        const items = build('Harmony', '#######', ['yxxxxxx']);
        const y = items.find((i) => i.char.toLowerCase() === 'y');
        expect(y?.isReal).toBe(true);
        expect(y?.locked).toBeFalsy();
    });

    it('pins the first letter from hint level 1 onward', () => {
        const items = build('Harmony', '#######', [], 1);
        expect(items[0].char).toBe('H');
        expect(items[0].isReal).toBe(true);
        expect(items[0].locked).toBe(true);
    });

    it('leaves the first letter masked below hint level 1', () => {
        expect(build('Harmony', '#######', [], 0)[0].char).toBe('#');
    });
});

describe('buildScrambleItems — structure', () => {
    it('produces one tile per code point', () => {
        expect(build('Harmony', '#######')).toHaveLength(7);
    });

    it('marks and pins spaces', () => {
        const items = build('a b', '#_#');
        expect(items[1].isSpace).toBe(true);
        expect(items[1].locked).toBe(true);
    });

    it('handles astral glyphs in the mask without splitting them', () => {
        const items = build('abc', '\u{1F711}\u{1F712}\u{1F713}');
        expect(items).toHaveLength(3);
        expect(items[0].char).toBe('\u{1F711}');
    });
});

describe('generateShuffledView', () => {
    const items = (): ScrambleItem[] => [
        { char: 'H', id: '0', isSpace: false, isReal: true, locked: true },
        { char: 'a', id: '1', isSpace: false, isReal: false },
        { char: 'b', id: '2', isSpace: false, isReal: false },
        { char: ' ', id: '3', isSpace: true, isReal: false, locked: true },
        { char: 'c', id: '4', isSpace: false, isReal: false },
    ];

    it('keeps pinned tiles exactly where they are', () => {
        for (let attempt = 0; attempt < 30; attempt++) {
            const shuffled = generateShuffledView(items());
            expect(shuffled[0].char).toBe('H');
            expect(shuffled[3].char).toBe(' ');
        }
    });

    it('preserves the multiset of characters, so nothing is added or lost', () => {
        const before = items().map((i) => i.char).sort();
        for (let attempt = 0; attempt < 30; attempt++) {
            const after = generateShuffledView(items()).map((i) => i.char).sort();
            expect(after).toEqual(before);
        }
    });

    it('returns the same number of tiles', () => {
        expect(generateShuffledView(items())).toHaveLength(5);
    });

    it('does eventually move the unpinned tiles', () => {
        const original = items().map((i) => i.char).join('');
        const seen = new Set<string>();
        for (let attempt = 0; attempt < 50; attempt++) {
            seen.add(generateShuffledView(items()).map((i) => i.char).join(''));
        }
        expect(seen.size).toBeGreaterThan(1);
        expect([...seen].some((s) => s !== original)).toBe(true);
    });

    it('handles an all-pinned set without stalling', () => {
        const pinned: ScrambleItem[] = [
            { char: 'a', id: '0', isSpace: false, isReal: true, locked: true },
        ];
        expect(generateShuffledView(pinned)).toHaveLength(1);
    });
});

describe('findNewlyRevealedIndices', () => {
    it('reports positions where the mask now shows the real letter', () => {
        const changed = findNewlyRevealedIndices('#####', 'C####', 'Chord');
        expect([...changed]).toEqual([0]);
    });

    it('ignores changes that are still masked', () => {
        expect(findNewlyRevealedIndices('#####', '~####', 'Chord').size).toBe(0);
    });

    it('ignores positions that were already revealed', () => {
        expect(findNewlyRevealedIndices('C####', 'C####', 'Chord').size).toBe(0);
    });

    it('handles a mask growing from empty', () => {
        expect([...findNewlyRevealedIndices('', 'Ch###', 'Chord')].sort()).toEqual([0, 1]);
    });

    it('compares by code point, not UTF-16 unit', () => {
        const text = 'a\u{1F711}c';
        expect(findNewlyRevealedIndices('###', '##c', text).has(2)).toBe(true);
    });
});

describe('isFillerChar', () => {
    it('recognises every sign the server actually masks with', () => {
        // The regression this guards: the filler set was a hand-written ASCII
        // list documented as matching gameLogic.ts that shared no character
        // with it, so every real mask glyph was mistaken for a revealed letter.
        for (const char of CIPHER_SIGNS) {
            expect(isFillerChar(char)).toBe(true);
        }
    });

    it('contains no character that could be mistaken for a letter', () => {
        for (const char of CIPHER_SIGNS) {
            expect(/[a-z0-9]/i.test(char)).toBe(false);
        }
    });

    it('does not treat an answer letter as filler', () => {
        for (const char of [...'abcdefghijklmnopqrstuvwxyz']) {
            expect(isFillerChar(char)).toBe(false);
        }
    });
});

describe('buildRandomCipher fills from the shared alphabet', () => {
    it('emits only filler signs, never letters that look like the answer', () => {
        for (const char of [...buildRandomCipher('Harmony Chord')]) {
            if (char === ' ') continue;
            expect(isFillerChar(char)).toBe(true);
        }
    });
});

describe('readMaskTile', () => {
    const SIGN = CIPHER_SIGNS[0];
    const state = (text: string, guesses: string[]) => computeGuessState(text, guesses);

    it('calls a letter guessed in position placed', () => {
        const tile = readMaskTile(SIGN, 'H', 0, state('Harmony', ['harpoon']), 0);
        expect(tile).toEqual({ char: 'H', state: 'placed', displaced: false });
    });

    it('calls a letter known only to be present "present", and not displaced', () => {
        // The renderer draws it at its true index, so claiming otherwise would
        // invite the player to rule out the one arrangement that is right.
        const tile = readMaskTile(SIGN, 'n', 4, state('Harmony', ['xxxxxny']), 0);
        expect(tile.state).toBe('present');
        expect(tile.displaced).toBe(false);
    });

    it('treats a mask letter below hint 2 as placed, since that mask is positional', () => {
        const tile = readMaskTile('H', 'H', 0, state('Harmony', []), 1);
        expect(tile).toEqual({ char: 'H', state: 'placed', displaced: false });
    });

    it('treats a mask letter from hint 2 as displaced, since that mask is an anagram', () => {
        const tile = readMaskTile('y', 'H', 0, state('Harmony', []), 2);
        expect(tile).toEqual({ char: 'y', state: 'present', displaced: true });
    });

    it('never promotes a hint-2 letter that coincidentally sits on its own index', () => {
        const tile = readMaskTile('H', 'H', 0, state('Harmony', []), 2);
        expect(tile.state).toBe('present');
        expect(tile.displaced).toBe(true);
    });

    it('calls a filler sign unknown, and never displaced', () => {
        const tile = readMaskTile(SIGN, 'H', 0, state('Harmony', []), 2);
        expect(tile).toEqual({ char: SIGN, state: 'unknown', displaced: false });
    });

    it('leaves spaces unknown rather than styling them as letters', () => {
        const tile = readMaskTile(' ', ' ', 0, state('a b', []), 2);
        expect(tile.state).toBe('unknown');
    });
});
