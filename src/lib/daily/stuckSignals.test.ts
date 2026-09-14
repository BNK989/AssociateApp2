import { describe, expect, it } from 'vitest';
import { MAX_HINT_LEVEL, STREAK_BONUS_AT } from '@/lib/gameConfig';
import {
    FIRST_OFFER_MS,
    SECOND_OFFER_MS,
    STRIKE_WORTH_MS,
    choicePrices,
    stuckOffer,
    type StuckInput,
} from './stuckSignals';

const base: StuckInput = {
    msOnWord: 0,
    strikes: 0,
    hintLevel: 0,
    canOpenOtherEnd: true,
    canSettle: false,
    settleLettersLeft: 3,
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

    it('escalates to help with the word once quiet has turned into stuck', () => {
        expect(at({ msOnWord: SECOND_OFFER_MS })).toEqual({ kind: 'letter' });
    });

    // Someone who has guessed and missed is further into being stuck than
    // someone who has merely been quiet.
    it('lets wrong guesses buy their way up the ladder', () => {
        expect(at({ msOnWord: 0, strikes: 1 })).toBeNull();
        expect(at({ msOnWord: FIRST_OFFER_MS - STRIKE_WORTH_MS, strikes: 1 }))
            .toMatchObject({ kind: 'stake' });
        expect(at({ msOnWord: SECOND_OFFER_MS - STRIKE_WORTH_MS, strikes: 1 }))
            .toEqual({ kind: 'letter' });
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

describe('the other end', () => {
    /**
     * It used to hold the second offer outright, as the one route that gives
     * nothing about the word away. Put to a player who had not yet been offered
     * a letter it read as "skip this" — and a dismissal there silenced the word,
     * so the help behind it was never reached. Help first, the way off it after.
     */
    it('is never offered ahead of help with the word in front of the player', () => {
        const stuck = { msOnWord: SECOND_OFFER_MS, canOpenOtherEnd: true };

        expect(at({ ...stuck, hintLevel: 0 })).toEqual({ kind: 'letter' });
        expect(at({ ...stuck, hintLevel: 1 })).toEqual({ kind: 'letter' });
        expect(at({ ...stuck, hintLevel: MAX_HINT_LEVEL, canSettle: true }))
            .toEqual({ kind: 'settle', lettersLeft: 3 });
    });

    it('is offered once the ladder is spent, ahead of the reveal', () => {
        // A word the player can still come at from the far side beats retiring
        // it unsolved.
        expect(at({
            msOnWord: SECOND_OFFER_MS,
            hintLevel: MAX_HINT_LEVEL,
            canSettle: false,
            canOpenOtherEnd: true,
        })).toEqual({ kind: 'other_end' });
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
        expect(at({ ...spent, canSettle: true })).toEqual({ kind: 'settle', lettersLeft: 3 });
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

    it('comes before the other end: help with this word before a way off it', () => {
        expect(at({ ...spent, canOpenOtherEnd: true, canSettle: true }))
            .toEqual({ kind: 'settle', lettersLeft: 3 });
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

describe('the choice at hint level 2', () => {
    /** Past the stake, one rung short of the clue. */
    const fork = { msOnWord: SECOND_OFFER_MS, hintLevel: MAX_HINT_LEVEL - 1, canOpenOtherEnd: false };

    // The two kinds of help left differ in kind — a sentence about the word,
    // or its shape — so the player is consulted rather than handed the rung.
    it('asks the player to pick when both the clue and the drip are on the table', () => {
        expect(at({ ...fork, canSettle: true })).toEqual({ kind: 'choice', lettersLeft: 3 });
    });

    it('offers the rung alone when there is nothing to place', () => {
        // The choice needs two real options. Alone, the clue is offered as a
        // letter has always been, so an empty pool never shows a dead button.
        expect(at({ ...fork, canSettle: false })).toEqual({ kind: 'letter' });
    });

    it('is the only rung that forks', () => {
        expect(at({ ...fork, hintLevel: 1, canSettle: true })).toEqual({ kind: 'letter' });
        expect(at({ ...fork, hintLevel: MAX_HINT_LEVEL, canSettle: true }))
            .toEqual({ kind: 'settle', lettersLeft: 3 });
    });

    it('is not held back by the other end still being open', () => {
        // The regression a game master hit on 2026-09-14: at level 2 with the
        // letters loose, the second offer was "Other end", and closing it
        // silenced the word, so the fork was never seen.
        expect(at({ ...fork, canSettle: true, canOpenOtherEnd: true }))
            .toEqual({ kind: 'choice', lettersLeft: 3 });
    });
});


describe('choicePrices', () => {
    it('quotes each fork at its own rate, rounded up like the deduction', () => {
        expect(choicePrices(17, { clueCost: 0.05, costPerLetter: 0.1 })).toEqual({ clue: 1, place: 2 });
    });

    it('quotes nothing for a free fork', () => {
        expect(choicePrices(17, { clueCost: 0, costPerLetter: 0 })).toEqual({ clue: 0, place: 0 });
    });
});
