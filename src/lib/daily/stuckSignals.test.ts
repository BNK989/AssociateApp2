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
    canSettle: false,
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

describe('the settle rung', () => {
    /** Past every threshold, with the ladder spent and the other end already in. */
    const spent = {
        msOnWord: SECOND_OFFER_MS,
        hintLevel: MAX_HINT_LEVEL,
        canOpenOtherEnd: false,
    };

    it('is offered once the ladder is spent and there is a letter to place', () => {
        expect(at({ ...spent, canSettle: true })).toEqual({ kind: 'settle' });
    });

    it('falls through to the reveal when there is nothing left to place', () => {
        // The pre-settle behaviour, unchanged: with an empty pool or a spent
        // allowance the rung collapses rather than appearing with nothing
        // behind it.
        expect(at({ ...spent, canSettle: false })).toEqual({ kind: 'reveal' });
    });

    it('never pre-empts a hint the player has not taken yet', () => {
        // The rung is the last one before the reveal, not a shortcut past the
        // ladder — so a word with rungs left gets the letter offer even when
        // the drip has candidates waiting.
        expect(at({ ...spent, hintLevel: 1, canSettle: true })).toEqual({ kind: 'letter' });
    });

    it('never pre-empts the other end, which costs the player less', () => {
        expect(at({ ...spent, canOpenOtherEnd: true, canSettle: true }))
            .toEqual({ kind: 'other_end' });
    });

    it('comes before the reveal, because it is the last offer that ends in a solve', () => {
        expect(at({ ...spent, canSettle: true })).not.toEqual({ kind: 'reveal' });
    });

    it('stays silent on a word the player has only just reached', () => {
        expect(at({ ...spent, msOnWord: 0, canSettle: true })).toBeNull();
    });

    it('says nothing at all once the offer is waved away', () => {
        expect(at({ ...spent, canSettle: true, dismissed: true })).toBeNull();
    });
});
