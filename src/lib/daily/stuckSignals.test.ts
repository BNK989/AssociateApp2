import { describe, expect, it } from 'vitest';
import { MAX_HINT_LEVEL, STREAK_BONUS_AT } from '@/lib/gameConfig';
import {
    FIRST_OFFER_MS,
    SECOND_OFFER_MS,
    STRIKE_WORTH_MS,
    THIRD_OFFER_MS,
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

describe('the other end', () => {
    it('holds the escalation slot only for its window', () => {
        expect(at({ msOnWord: THIRD_OFFER_MS - 1 })).toEqual({ kind: 'other_end' });
        expect(at({ msOnWord: THIRD_OFFER_MS })).toEqual({ kind: 'letter' });
    });

    /**
     * The regression this window exists to prevent.
     *
     * With the auto-hint clock off, nothing hands out the ladder on its own. A
     * player who stays on the word and declines to go elsewhere would otherwise
     * be shown the same lateral move for as long as they sat there, and never
     * be offered help with the word actually in front of them.
     */
    it('lets a player who will not leave the word still reach the ladder', () => {
        const staying = { canOpenOtherEnd: true, hintLevel: 0 };

        expect(at({ ...staying, msOnWord: SECOND_OFFER_MS })).toEqual({ kind: 'other_end' });
        expect(at({ ...staying, msOnWord: THIRD_OFFER_MS })).toEqual({ kind: 'letter' });
    });

    it('lets wrong guesses buy their way past the window too', () => {
        expect(at({ msOnWord: THIRD_OFFER_MS - STRIKE_WORTH_MS, strikes: 1 }))
            .toEqual({ kind: 'letter' });
    });

    it('comes back below the ladder rather than being lost', () => {
        // Passed over further up, but a word the player can still come at from
        // the far side beats retiring it unsolved.
        expect(at({
            msOnWord: THIRD_OFFER_MS,
            hintLevel: MAX_HINT_LEVEL,
            canSettle: false,
            canOpenOtherEnd: true,
        })).toEqual({ kind: 'other_end' });
    });

    it('still yields to the rungs that address this word', () => {
        const late = { msOnWord: THIRD_OFFER_MS, canOpenOtherEnd: true };

        expect(at({ ...late, hintLevel: 1 })).toEqual({ kind: 'letter' });
        expect(at({ ...late, hintLevel: MAX_HINT_LEVEL, canSettle: true }))
            .toEqual({ kind: 'settle', lettersLeft: 3 });
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

describe('the choice at hint level 2', () => {
    /** Past the other end's window, one rung short of the clue. */
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

    it('still waits its turn behind the other end', () => {
        expect(at({ ...fork, canSettle: true, canOpenOtherEnd: true })).toEqual({ kind: 'other_end' });
        expect(at({ ...fork, canSettle: true, canOpenOtherEnd: true, msOnWord: THIRD_OFFER_MS }))
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
