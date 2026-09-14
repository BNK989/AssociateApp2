import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { DEFAULT_SETTLE_POLICY, type SettlePolicy } from '@/lib/daily/settlePolicy';
import { ChoiceForkFields } from './ChoiceForkFields';

afterEach(() => cleanup());

/**
 * The panel that composes the fork.
 *
 * The row editing itself is pure and tested next door in
 * `choiceOptionEdits.test.ts`. What is left here is the wiring a game master
 * actually touches: that every option has a switch, that the arrows are dead at
 * the ends of the row and live in the middle, and that a fork which cannot be a
 * question says so rather than leaving the panel looking armed.
 */
function policy(overrides: Partial<SettlePolicy> = {}): SettlePolicy {
    return { ...DEFAULT_SETTLE_POLICY, ...overrides };
}

function setup(overrides: Partial<SettlePolicy> = {}) {
    const setField = vi.fn();
    render(<ChoiceForkFields policy={policy(overrides)} setField={setField} />);
    return setField;
}

describe('ChoiceForkFields', () => {
    it('offers every option a switch, on for the ones on the row', () => {
        setup();

        expect(screen.getByLabelText('Offer: The written clue').getAttribute('aria-checked'))
            .toBe('true');
        expect(screen.getByLabelText('Offer: Place the loose letters').getAttribute('aria-checked'))
            .toBe('true');
        expect(screen.getByLabelText('Offer: Open the other end').getAttribute('aria-checked'))
            .toBe('false');
        expect(screen.getByLabelText('Offer: Reveal the word').getAttribute('aria-checked'))
            .toBe('false');
    });

    it('writes the new row when an option is switched on', () => {
        const setField = setup();

        fireEvent.click(screen.getByLabelText('Offer: Reveal the word'));

        expect(setField).toHaveBeenCalledWith('choiceOptions', ['clue', 'place', 'reveal']);
    });

    it('moves an option along the row', () => {
        const setField = setup();

        fireEvent.click(screen.getByLabelText('Move later: The written clue'));

        expect(setField).toHaveBeenCalledWith('choiceOptions', ['place', 'clue']);
    });

    // The arrows must never promise a move that is not there: nothing sits
    // above the first option, below the last, or beside one that is off.
    it('deadens the arrows at both ends of the row and off it', () => {
        setup();

        expect(screen.getByLabelText('Move earlier: The written clue')).toHaveProperty('disabled', true);
        expect(screen.getByLabelText('Move later: Place the loose letters')).toHaveProperty('disabled', true);
        expect(screen.getByLabelText('Move earlier: Reveal the word')).toHaveProperty('disabled', true);
        expect(screen.getByLabelText('Move later: Reveal the word')).toHaveProperty('disabled', true);
    });

    it('says the fork is off when no rung asks, and greys the prices with it', () => {
        setup({ choiceAtHintLevel: null });

        expect(screen.getByText(/The fork is off/)).toBeTruthy();
        expect(screen.getByLabelText('Show point costs on the fork'))
            .toHaveProperty('disabled', true);
    });

    it('says the fork is off when one option cannot be a question', () => {
        setup({ choiceOptions: ['clue'] });

        expect(screen.getByText(/The fork is off/)).toBeTruthy();
    });

    it('stands armed when a rung asks and two options stand on it', () => {
        setup();

        expect(screen.queryByText(/The fork is off/)).toBeNull();
        expect(screen.getByLabelText('Show point costs on the fork'))
            .toHaveProperty('disabled', false);
    });
});
