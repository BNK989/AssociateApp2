import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSlotTyping } from './useSlotTyping';

const setup = (overrides: Partial<Parameters<typeof useSlotTyping>[0]> = {}) => {
    const setInput = vi.fn();
    const view = renderHook((props: Parameters<typeof useSlotTyping>[0]) => useSlotTyping(props), {
        initialProps: {
            text: 'Harmony',
            guesses: ['harpoon'],
            mode: 'skip' as const,
            targetId: 'msg1',
            setInput,
            ...overrides,
        },
    });
    return { ...view, setInput };
};

describe('useSlotTyping — ownership of the submitted value', () => {
    // The regression this guards: the hook runs on every render of the composer,
    // including the chain phase where there is no word to solve. Without the
    // guard it blanked the player's message on mount.
    it('does not touch the input when there is no word to solve', () => {
        const { setInput } = setup({ text: null });
        expect(setInput).not.toHaveBeenCalled();
    });

    it('reports an empty value while the strip is incomplete', () => {
        const { setInput } = setup();
        expect(setInput).toHaveBeenLastCalledWith('');
    });

    it('reports the assembled answer once every slot is filled', () => {
        const { result, setInput } = setup();
        act(() => result.current.onTypedChange('mny'));
        expect(setInput).toHaveBeenLastCalledWith('Harmony');
    });

    it('assembles from the greens the player never typed', () => {
        // Only three characters were typed; the other four are earned.
        const { result } = setup();
        act(() => result.current.onTypedChange('mny'));
        expect(result.current.typed).toBe('mny');
        expect(result.current.model?.attempt).toBe('Harmony');
    });
});

describe('useSlotTyping — typing', () => {
    it('accepts up to the whole word, so the whole-word reading can be reached', () => {
        const { result } = setup();
        act(() => result.current.onTypedChange('harmony'));
        expect(result.current.typed).toBe('harmony');
        expect(result.current.model?.attempt).toBe('Harmony');
    });

    it('drops characters past the whole word', () => {
        const { result } = setup();
        act(() => result.current.onTypedChange('harmonyXXX'));
        expect(result.current.typed).toBe('harmony');
    });

    // The point of the whole exercise: neither habit has to be learned.
    it('reads the gaps and the whole word as the same answer', () => {
        const gaps = setup();
        act(() => gaps.result.current.onTypedChange('mny'));

        const whole = setup();
        act(() => whole.result.current.onTypedChange('harmony'));

        expect(gaps.result.current.model?.attempt).toBe('Harmony');
        expect(whole.result.current.model?.attempt).toBe('Harmony');
    });

    it('ignores a typed space, which the strip supplies itself', () => {
        const { result } = setup({ text: 'go on', guesses: [] });
        act(() => result.current.onTypedChange('go on'));
        expect(result.current.typed).toBe('goon');
        expect(result.current.model?.attempt).toBe('go on');
    });

    it('binds a typed letter to the pool tile it came from', () => {
        const { result } = setup();
        act(() => result.current.onTypedChange('m'));
        // 'n' is the only pooled letter; 'm' was never found, so nothing binds.
        expect(result.current.model?.placed.size).toBe(0);

        // Read the id off the pool rather than spelling it out: it carries the
        // word's identity so that tiles animate in when the chain advances.
        const nTile = result.current.model!.pool.find((letter) => letter.char === 'n')!;
        act(() => result.current.onTypedChange('mn'));
        expect(result.current.model?.placed.has(nTile.id)).toBe(true);
    });

    it('puts the caret on the first unfilled slot', () => {
        const { result } = setup();
        expect(result.current.model?.caretIndex).toBe(3);
        act(() => result.current.onTypedChange('m'));
        expect(result.current.model?.caretIndex).toBe(5);
    });

    it('has no caret once the strip is full', () => {
        const { result } = setup();
        act(() => result.current.onTypedChange('mny'));
        expect(result.current.model?.caretIndex).toBeNull();
    });
});

describe('useSlotTyping — resets', () => {
    it('clears the strip when the chain moves to a new word', () => {
        const { result, rerender, setInput } = setup();
        act(() => result.current.onTypedChange('mny'));
        expect(result.current.typed).toBe('mny');

        rerender({
            text: 'Chord', guesses: [], mode: 'skip', targetId: 'msg2', setInput,
        });
        expect(result.current.typed).toBe('');
    });

    it('clears the strip when a guess is recorded', () => {
        const { result, rerender, setInput } = setup();
        act(() => result.current.onTypedChange('mn'));

        rerender({
            text: 'Harmony', guesses: ['harpoon', 'harmons'], mode: 'skip', targetId: 'msg1', setInput,
        });
        expect(result.current.typed).toBe('');
    });
});

describe('useSlotTyping — a letter the settle drip is flying in', () => {
    /**
     * The binding that makes the animation possible at all.
     *
     * A settled letter counts as placed, which takes it out of the pool and
     * unmounts its halo chip — and a chip that has unmounted has no rectangle
     * to fly from. So while a letter is in the air it is bound here instead:
     * still in the pool, but claiming its slot, which is exactly the state a
     * letter the *player* typed is in. `useLetterFlights` cannot tell the two
     * apart, and that is the point.
     */
    const flying = (index: number) => setup({
        text: 'Harmony',
        guesses: ['harpoon'],
        pendingSettle: index,
    });

    // HARMONY against "harpoon": h, a, r and o land in place, so the one
    // letter found-but-unplaced is the N at index 5. That is the only position
    // the drip could ever choose here.
    const FLYING_INDEX = 5;
    const FLYING_ID = `pool-msg1-${FLYING_INDEX}`;

    it('keeps the flying letter in the pool, so it still has a chip to leave from', () => {
        const { result } = flying(FLYING_INDEX);
        const ids = result.current.model!.pool.map((letter) => letter.id);

        expect(ids).toContain(FLYING_ID);
    });

    it('binds it to the slot it is heading for, which is what launches the flight', () => {
        const { result } = flying(FLYING_INDEX);

        expect(result.current.model!.placements.get(FLYING_ID)).toBe(FLYING_INDEX);
        expect(result.current.model!.placed.has(FLYING_ID)).toBe(true);
        expect(result.current.model!.flyingId).toBe(FLYING_ID);
    });

    it('fills the cell it is flying to, so the letter has somewhere to land', () => {
        const { result } = flying(FLYING_INDEX);
        const slot = result.current.model!.slots.find((cell) => cell.index === FLYING_INDEX);

        expect(slot?.char?.toLowerCase()).toBe('n');
        expect(slot?.poolId).toBe(FLYING_ID);
    });

    it('lends a chip to a letter that was never loose, so the drip can open one', () => {
        // No guesses, so nothing is found and the pool is empty — which since
        // the scramble went is the ordinary state of a word at the clue. The
        // drip may open a letter there, and an opened letter still has to be
        // seen to travel, so it borrows a chip for the length of its flight.
        const { result } = setup({
            text: 'Harmony',
            guesses: [],
            pendingSettle: FLYING_INDEX,
        });

        expect(result.current.model!.pool.map((letter) => letter.id)).toContain(FLYING_ID);
        expect(result.current.model!.flyingId).toBe(FLYING_ID);
        expect(result.current.model!.slots.find((cell) => cell.index === FLYING_INDEX)?.char)
            .toBe('n');
    });

    it('still refuses a position the strip is not holding open', () => {
        // The board moved underneath the flight. Index 0 is green against
        // "harpoon", so there is no open slot to land in and nothing is drawn —
        // the refusal that matters, kept where it can still be checked.
        const { result } = setup({
            text: 'Harmony',
            guesses: ['harpoon'],
            pendingSettle: 0,
        });

        expect(result.current.model!.flyingId).toBeNull();
    });

    it('leaves the rest of the strip alone', () => {
        // It fills a slot that was open and touches nothing else — the reading
        // of what the player typed must not shift underneath them.
        const plain = setup({ text: 'Harmony', guesses: ['harpoon'] });
        const withFlight = flying(FLYING_INDEX);

        expect(withFlight.result.current.model!.groups.length)
            .toBe(plain.result.current.model!.groups.length);
    });
});

