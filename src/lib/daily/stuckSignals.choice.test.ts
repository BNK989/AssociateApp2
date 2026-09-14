import { describe, expect, it } from 'vitest';
import { MAX_HINT_LEVEL } from '@/lib/gameConfig';
import {
    DEFAULT_CHOICE_FORK,
    SECOND_OFFER_MS,
    stuckOffer,
    type ChoiceFork,
    type StuckInput,
} from './stuckSignals';

/**
 * The fork the game master composes.
 *
 * The shipped default is covered next door, in `stuckSignals.test.ts`, along
 * with the rest of the ladder. What is tested here is the part a game master
 * can move: which rung asks, what stands on it, and the one rule that keeps a
 * composed fork from ever showing a dead button — fewer than two live options
 * and the fork stands aside, leaving the ladder exactly as it was.
 */

const base: StuckInput = {
    msOnWord: SECOND_OFFER_MS,
    strikes: 0,
    hintLevel: 0,
    canOpenOtherEnd: true,
    canSettle: true,
    settleLettersLeft: 3,
    consecutive: 0,
    wordsLeft: 4,
    dismissed: false,
};

const at = (overrides: Partial<StuckInput>) => stuckOffer({ ...base, ...overrides });

const fork = (over: Partial<ChoiceFork> = {}): ChoiceFork => ({
    ...DEFAULT_CHOICE_FORK,
    ...over,
});

describe('stuckOffer -- where the game master puts the fork', () => {
    it('asks at the rung it is pointed at, and only there', () => {
        const choice = fork({ atHintLevel: 0 });

        expect(at({ hintLevel: 0, choice })).toMatchObject({ kind: 'choice' });
        expect(at({ hintLevel: 1, choice })).toEqual({ kind: 'letter' });
    });

    // null is the fork switched off. The ladder below it has not changed, so
    // it simply runs the way it did before the fork existed.
    it('runs straight through when no rung asks', () => {
        const choice = fork({ atHintLevel: null });

        expect(at({ hintLevel: MAX_HINT_LEVEL - 1, choice })).toEqual({ kind: 'letter' });
        expect(at({ hintLevel: MAX_HINT_LEVEL, choice }))
            .toEqual({ kind: 'settle', lettersLeft: 3 });
    });

    it('carries the row it was given, in the order it was given', () => {
        const choice = fork({ atHintLevel: 1, options: ['reveal', 'place', 'clue'] });

        expect(at({ hintLevel: 1, choice })).toEqual({
            kind: 'choice',
            lettersLeft: 3,
            options: ['reveal', 'place', 'clue'],
        });
    });
});

describe('stuckOffer -- what the fork drops before the player sees it', () => {
    // Same rule the ladder itself follows: never offer a button with nothing
    // wired to it. The fork filters, then decides whether what is left is
    // still a question worth asking.
    it('drops the clue once the ladder is spent', () => {
        const choice = fork({ atHintLevel: MAX_HINT_LEVEL, options: ['clue', 'place', 'reveal'] });

        expect(at({ hintLevel: MAX_HINT_LEVEL, choice })).toEqual({
            kind: 'choice',
            lettersLeft: 3,
            options: ['place', 'reveal'],
        });
    });

    it('drops the letters when there is nothing left to place', () => {
        const choice = fork({ atHintLevel: 1, options: ['clue', 'place', 'reveal'] });

        expect(at({ hintLevel: 1, canSettle: false, choice })).toEqual({
            kind: 'choice',
            lettersLeft: 3,
            options: ['clue', 'reveal'],
        });
    });

    it('drops the other end once the chain is open from both sides', () => {
        const choice = fork({ atHintLevel: 1, options: ['clue', 'other_end', 'reveal'] });

        expect(at({ hintLevel: 1, canOpenOtherEnd: false, choice })).toEqual({
            kind: 'choice',
            lettersLeft: 3,
            options: ['clue', 'reveal'],
        });
    });

    it('never drops the reveal, which always has a word behind it', () => {
        const choice = fork({ atHintLevel: MAX_HINT_LEVEL, options: ['clue', 'reveal'] });

        // The clue is spent and the chain is open, so the reveal is the only
        // one of the two still live -- and one button is not a choice.
        expect(at({ hintLevel: MAX_HINT_LEVEL, canSettle: false, canOpenOtherEnd: false, choice }))
            .toEqual({ kind: 'reveal' });
    });
});

describe('stuckOffer -- a fork that cannot be a question stands aside', () => {
    // A choice of one is the rung it replaced wearing a question mark. Worse,
    // it would hide the ladder's own ordering behind a bar that reads as a
    // decision, so the fork gets out of the way entirely.
    it('falls back to the ladder when only one option is live', () => {
        const choice = fork({ atHintLevel: 1, options: ['clue', 'place'] });

        expect(at({ hintLevel: 1, canSettle: false, choice })).toEqual({ kind: 'letter' });
    });

    it('falls back when the game master empties the row', () => {
        const choice = fork({ atHintLevel: 1, options: [] });

        expect(at({ hintLevel: 1, choice })).toEqual({ kind: 'letter' });
    });

    // The fallback is the ladder as it stands at that moment, not a fixed
    // rung: past the last hint it is the drip, then the other end, then the
    // reveal, exactly as if the fork had never been configured.
    it('falls back to whatever the ladder would have said', () => {
        const choice = fork({ atHintLevel: MAX_HINT_LEVEL, options: ['clue'] });

        expect(at({ hintLevel: MAX_HINT_LEVEL, choice }))
            .toEqual({ kind: 'settle', lettersLeft: 3 });
        expect(at({ hintLevel: MAX_HINT_LEVEL, canSettle: false, choice }))
            .toEqual({ kind: 'other_end' });
        expect(at({ hintLevel: MAX_HINT_LEVEL, canSettle: false, canOpenOtherEnd: false, choice }))
            .toEqual({ kind: 'reveal' });
    });

    it('still says nothing before the clock or after a dismissal', () => {
        const choice = fork({ atHintLevel: 1 });

        expect(at({ hintLevel: 1, msOnWord: 0, choice })).toBeNull();
        expect(at({ hintLevel: 1, dismissed: true, choice })).toBeNull();
    });
});
