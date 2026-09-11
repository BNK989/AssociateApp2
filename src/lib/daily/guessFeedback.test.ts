import { describe, expect, it } from 'vitest';
import { calculateSimilarity } from '@/lib/gameLogic';
import {
    bandFor,
    consumesStrike,
    missMessageKey,
    MAX_FORGIVEN_NEAR_MISSES,
    NEAR_MISS_THRESHOLD,
} from './guessFeedback';
import { MATCH_THRESHOLD } from '@/lib/gameConfig';

describe('bandFor', () => {
    it('accepts anything at or above the match threshold', () => {
        expect(bandFor(1)).toBe('match');
        expect(bandFor(MATCH_THRESHOLD)).toBe('match');
    });

    it('calls the gap below it a near miss', () => {
        expect(bandFor(NEAR_MISS_THRESHOLD)).toBe('near');
        expect(bandFor(MATCH_THRESHOLD - 0.01)).toBe('near');
    });

    it('calls everything else off', () => {
        expect(bandFor(NEAR_MISS_THRESHOLD - 0.01)).toBe('off');
        expect(bandFor(0)).toBe('off');
    });
});

describe('bandFor, against real guesses', () => {
    // The bands only earn their keep if the words a player actually mistypes
    // land in them, so these assert against the similarity function itself
    // rather than against invented numbers.
    it('bands a transposition as a near miss', () => {
        expect(bandFor(calculateSimilarity('recieve', 'receive'))).toBe('near');
    });

    // The band's real work is on short words. MATCH_THRESHOLD is a *ratio*, so
    // one wrong letter costs 1/9 of a nine-letter word and is waved through,
    // but 1/3 of a three-letter word and is a strike. The same slip is free on
    // a long word and fatal on a short one, which is the unfairness this band
    // exists to soften.
    it('catches the one-letter slip that a short word would be struck for', () => {
        expect(bandFor(calculateSimilarity('elephants', 'elephant'))).toBe('match');
        expect(bandFor(calculateSimilarity('cot', 'cat'))).toBe('near');
        expect(bandFor(calculateSimilarity('sun', 'sin'))).toBe('near');
    });

    it('bands an unrelated word as off', () => {
        expect(bandFor(calculateSimilarity('tractor', 'holiday'))).toBe('off');
        expect(bandFor(calculateSimilarity('sky', 'elephant'))).toBe('off');
    });
});

describe('consumesStrike', () => {
    it('always charges for a guess that was not close', () => {
        expect(consumesStrike('off', 0)).toBe(true);
    });

    it('forgives the first near miss on a word', () => {
        expect(consumesStrike('near', 0)).toBe(false);
    });

    it('stops forgiving once the allowance is spent', () => {
        expect(consumesStrike('near', MAX_FORGIVEN_NEAR_MISSES)).toBe(true);
        expect(consumesStrike('near', MAX_FORGIVEN_NEAR_MISSES + 1)).toBe(true);
    });
});

describe('missMessageKey', () => {
    it('says nothing about a guess that was not close', () => {
        expect(missMessageKey('off', false)).toBeNull();
    });

    it('distinguishes a forgiven near miss from a charged one', () => {
        expect(missMessageKey('near', true)).toBe('miss_near_forgiven');
        expect(missMessageKey('near', false)).toBe('miss_near');
    });
});
