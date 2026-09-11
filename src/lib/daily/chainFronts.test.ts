import { describe, expect, it } from 'vitest';
import { MAX_STRIKES } from '@/lib/gameConfig';
import {
    canOpenOtherEnd,
    findDailyTarget,
    isOtherEndOpen,
    MIN_WORDS_TO_OPEN_OTHER_END,
    wordsInPlay,
} from './chainFronts';

type Word = { id: string; is_solved: boolean; strikes?: number };

const open = (id: string, strikes = 0): Word => ({ id, is_solved: false, strikes });
const done = (id: string): Word => ({ id, is_solved: true, strikes: 0 });

/** A fresh five-word chain: the final word is given, the rest are in play. */
const fresh = (): Word[] => [open('w0'), open('w1'), open('w2'), open('w3'), done('w4')];

describe('wordsInPlay', () => {
    it('drops solved words and struck-out ones', () => {
        const messages = [open('a'), done('b'), open('c', MAX_STRIKES), open('d')];
        expect(wordsInPlay(messages).map((m) => m.id)).toEqual(['a', 'd']);
    });
});

describe('findDailyTarget', () => {
    it('works backwards from the end while only one front is open', () => {
        expect(findDailyTarget(fresh())?.id).toBe('w3');
    });

    it('switches to the forward front once the other end is open', () => {
        const messages = fresh();
        messages[0] = done('w0');

        // w3 is the word the player walked away from; w1 is the one they can
        // now reason about, because w0 is known.
        expect(findDailyTarget(messages)?.id).toBe('w1');
    });

    it('closes the gap from the start until the fronts meet', () => {
        const messages: Word[] = [done('w0'), done('w1'), open('w2'), open('w3'), done('w4')];
        expect(findDailyTarget(messages)?.id).toBe('w2');
    });

    it('has nothing to offer on a finished board', () => {
        expect(findDailyTarget([done('a'), done('b')])).toBeUndefined();
        expect(findDailyTarget([])).toBeUndefined();
    });
});

describe('isOtherEndOpen', () => {
    it('is false on a fresh chain', () => {
        expect(isOtherEndOpen(fresh())).toBe(false);
    });

    // The derivation only holds because a backwards-played chain solves its
    // first word last; if that ever stops being true, this is the test that
    // should fail.
    it('is true once the first word has left the board', () => {
        const messages = fresh();
        messages[0] = done('w0');
        expect(isOtherEndOpen(messages)).toBe(true);
    });

    it('is not confused by an empty board', () => {
        expect(isOtherEndOpen([])).toBe(false);
    });
});

describe('canOpenOtherEnd', () => {
    it('is available on a chain with room to converge', () => {
        expect(canOpenOtherEnd(fresh())).toBe(true);
    });

    it('is spent once it has been used', () => {
        const messages = fresh();
        messages[0] = done('w0');
        expect(canOpenOtherEnd(messages)).toBe(false);
    });

    // Below the floor the word it hands over is the stuck word or its
    // neighbour, which makes it an expensive way to press Reveal.
    it('withdraws once too few words are left for it to help', () => {
        const messages: Word[] = [open('w0'), open('w1'), done('w2'), done('w3')];
        expect(wordsInPlay(messages)).toHaveLength(MIN_WORDS_TO_OPEN_OTHER_END - 1);
        expect(canOpenOtherEnd(messages)).toBe(false);
    });

    it('has nothing to open on an empty board', () => {
        expect(canOpenOtherEnd([])).toBe(false);
    });
});
