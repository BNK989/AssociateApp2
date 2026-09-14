import { describe, expect, it } from 'vitest';
import { moveOption, orderedOptions, toggleOption } from './choiceOptionEdits';

describe('orderedOptions', () => {
    it('lists the chosen row first, in the game master\'s order', () => {
        expect(orderedOptions(['place', 'clue'])).toEqual([
            'place', 'clue', 'other_end', 'reveal',
        ]);
    });

    it('keeps every option on the page when none are chosen', () => {
        expect(orderedOptions([])).toEqual(['clue', 'place', 'other_end', 'reveal']);
    });
});

describe('toggleOption', () => {
    it('adds at the end, so switches already on do not move', () => {
        expect(toggleOption(['clue', 'place'], 'reveal')).toEqual(['clue', 'place', 'reveal']);
    });

    it('takes an option out without disturbing the rest', () => {
        expect(toggleOption(['clue', 'place', 'reveal'], 'place')).toEqual(['clue', 'reveal']);
    });

    it('leaves the stored row alone', () => {
        const chosen: readonly ('clue' | 'place')[] = ['clue', 'place'];
        toggleOption(chosen, 'clue');
        expect(chosen).toEqual(['clue', 'place']);
    });
});

describe('moveOption', () => {
    it('swaps an option with its neighbour', () => {
        expect(moveOption(['clue', 'place', 'reveal'], 'place', -1))
            .toEqual(['place', 'clue', 'reveal']);
        expect(moveOption(['clue', 'place', 'reveal'], 'place', 1))
            .toEqual(['clue', 'reveal', 'place']);
    });

    // The arrows at either end are disabled, but the rule belongs here rather
    // than in the markup: a row edited from anywhere else must not wrap around.
    it('refuses to move off either end', () => {
        expect(moveOption(['clue', 'place'], 'clue', -1)).toEqual(['clue', 'place']);
        expect(moveOption(['clue', 'place'], 'place', 1)).toEqual(['clue', 'place']);
    });

    it('ignores an option that is not in the row', () => {
        expect(moveOption(['clue', 'place'], 'reveal', -1)).toEqual(['clue', 'place']);
    });
});
