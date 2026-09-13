import { describe, expect, it , vi } from 'vitest';
import {
    buildLetterPool,
    knownUnplacedIndices,
    placedIndices,
} from './poolRules';
import { buildSlots, typeableIndices } from './slotRules';

/**
 * With the anagram switched on.
 *
 * `SCRAMBLE_MASK` ships off — hint 2 reveals its letters in place now, so a
 * suite written against the shuffled mask would quietly stop exercising
 * anything rather than fail. The mechanic still exists behind the switch for a
 * game master to turn back on, so these cases state the premise instead of
 * inheriting it.
 */
vi.mock('@/lib/gameConfig', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/gameConfig')>();
    return { ...actual, SCRAMBLE_MASK: true, maskIsScrambled: (level: number) => level >= 2 };
});


/**
 * What a settled letter is, from the rules' point of view.
 *
 * Its own file rather than another block in `poolRules.test.ts`, which is at
 * the line cap — and the seam is a real one: everything here is about the drip
 * writing into a structure the pool already had, rather than about the pool
 * itself.
 *
 * The claim under test throughout: **a settled letter is a green letter.** It
 * is filled in, skipped by the caret, gone from the halo, and indistinguishable
 * on screen from one the player earned. The board teaches three tile states and
 * a fourth for "the game put this here" would cost more than it told anyone.
 */

describe('settled letters', () => {
    /** A level-2 mask: an anagram, so every letter is known and none is placed. */
    const mask = { cipher: 'GNILRATS', hintLevel: 2 };

    it('reads as placed, exactly as an earned green does', () => {
        // The three-state rule in `knowledge base/letter_feedback.md` is what
        // makes the board readable, and a fourth state for "the game put this
        // here" would cost more than it told anyone. So a settled letter is a
        // green letter, full stop.
        const placed = placedIndices('STARLING', [], undefined, new Set([3]));
        expect(placed.has(3)).toBe(true);
    });

    it('leaves the pool once it has a place', () => {
        const before = buildLetterPool('STARLING', [], [], mask, 'pool');
        const after = buildLetterPool('STARLING', [], [], mask, 'pool', new Set([3]));

        expect(after).toHaveLength(before.length - 1);
        expect(after.map((l) => l.id)).not.toContain('pool-3');
    });

    it('does not make the word line appear to gain a letter', () => {
        // The mask's budget is spent by the settled letter on its way out. Get
        // this wrong and a word with two Rs, one of them settled, still shows
        // two loose Rs in the halo — the board would look like it had handed
        // over a letter it never had.
        const word = 'STARLING';
        const loose = (settled: number[]) =>
            buildLetterPool(word, [], [], mask, 'pool', new Set(settled))
                .filter((l) => l.char.toLowerCase() === 'r').length;

        // R sits at index 3; settling it must take the only loose R with it.
        expect(loose([])).toBe(1);
        expect(loose([3])).toBe(0);
    });

    it('never offers the same position twice', () => {
        const first = knownUnplacedIndices('STARLING', [], mask, new Set());
        const second = knownUnplacedIndices('STARLING', [], mask, new Set([first[0]]));

        expect(second).not.toContain(first[0]);
    });

    it('fills the slot in rather than asking the player to type it', () => {
        const built = buildSlots({
            text: 'STARLING',
            guesses: [],
            typed: '',
            mode: 'skip',
            mask,
            settled: new Set([3]),
        });

        expect(built[3].kind).toBe('green');
        expect(built[3].char).toBe('R');
    });

    it('takes the settled slot out of what the caret walks', () => {
        const placed = placedIndices('STARLING', [], undefined, new Set([3]));
        expect(typeableIndices('STARLING', placed, 'skip')).not.toContain(3);
    });
});
