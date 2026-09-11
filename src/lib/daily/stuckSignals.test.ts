import { describe, expect, it } from 'vitest';
import { MAX_HINT_LEVEL, STREAK_BONUS_AT } from '@/lib/gameConfig';
import {
    FIRST_OFFER_MS,
    SECOND_OFFER_MS,
    STRIKE_WORTH_MS,
    stuckOffer,
    type StuckInput,
} from './stuckSignals';

const base: StuckInput = {
    msOnWord: 0,
    strikes: 0,
    hintLevel: 0,
    canOpenOtherEnd: true,
    consecutive: 0,
    wordsLeft: 4,
    dismissed: false,
};

const at = (overrides: Partial<StuckInput>) => stuckOffer({ ...base, ...overrides });

describe('stuckOffer', () => {
    // Silence is the common case. Interrupting someone mid-deduction to ask
    // whether they are stuck is its own kind of insult.
    it('says nothing while the player is still thinking', () => {
        expect(at({ msOnWord: 0 })).toBeNull();
        expect(at({ msOnWord: FIRST_OFFER_MS - 1 })).toBeNull();
    });

    it('opens with a reason to keep going rather than a route out', () => {
        expect(at({ msOnWord: FIRST_OFFER_MS })).toEqual({
            kind: 'stake',
            solvesToBonus: STREAK_BONUS_AT,
            wordsLeft: 4,
        });
    });

    it('reports how close the bonus actually is', () => {
        const offer = at({ msOnWord: FIRST_OFFER_MS, consecutive: STREAK_BONUS_AT - 1 });
        expect(offer).toMatchObject({ kind: 'stake', solvesToBonus: 1 });
    });

    it('escalates to a route once quiet has turned into stuck', () => {
        expect(at({ msOnWord: SECOND_OFFER_MS })).toEqual({ kind: 'other_end' });
    });

    // Someone who has guessed and missed is further into being stuck than
    // someone who has merely been quiet.
    it('lets wrong guesses buy their way up the ladder', () => {
        expect(at({ msOnWord: 0, strikes: 1 })).toBeNull();
        expect(at({ msOnWord: FIRST_OFFER_MS - STRIKE_WORTH_MS, strikes: 1 }))
            .toMatchObject({ kind: 'stake' });
        expect(at({ msOnWord: SECOND_OFFER_MS - STRIKE_WORTH_MS, strikes: 1 }))
            .toEqual({ kind: 'other_end' });
    });

    it('skips a route that has nothing left to give', () => {
        const spent = { msOnWord: SECOND_OFFER_MS, canOpenOtherEnd: false };

        expect(at(spent)).toEqual({ kind: 'letter' });
        expect(at({ ...spent, hintLevel: MAX_HINT_LEVEL })).toEqual({ kind: 'reveal' });
    });

    // Reveal is last on purpose: it is the only offer that ends the word.
    it('reaches reveal only when nothing cheaper is available', () => {
        expect(at({
            msOnWord: SECOND_OFFER_MS,
            canOpenOtherEnd: true,
            hintLevel: MAX_HINT_LEVEL,
        })).toEqual({ kind: 'other_end' });
    });

    it('stays quiet once the player has waved it away', () => {
        expect(at({ msOnWord: SECOND_OFFER_MS, dismissed: true })).toBeNull();
    });
});
