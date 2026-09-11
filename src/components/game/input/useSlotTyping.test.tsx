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
