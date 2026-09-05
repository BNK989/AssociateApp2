import { describe, it, expect, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { CipherText } from './CipherText';
import { CIPHER_SIGNS } from '@/lib/gameConfig';

afterEach(() => cleanup());

const WORD = 'Wood';
// Masks are built from CIPHER_SIGNS, the alphabet the server actually emits.
// These fixtures used ASCII symbols that no mask has ever contained, which is
// how the filler-detection drift went unnoticed for so long.
const CIPHER_L0 = CIPHER_SIGNS.slice(0, 4).join('');
// Hint cipher: first letter revealed, the rest still masked
const CIPHER_L2 = `W${CIPHER_SIGNS.slice(1, 4).join('')}`;
// A wrong guess that only reveals 'd' -> 'o' stays masked
const GUESSES = ['dial'];

const flush = async (ms: number) => {
    await act(async () => {
        await new Promise(r => setTimeout(r, ms));
    });
};

describe('CipherText reveal after solve', () => {
    it('shows the full word once solved (scramble already settled)', async () => {
        const { container, rerender } = render(
            <CipherText text={WORD} cipherText={CIPHER_L0} visible={false} hintLevel={0} guesses={[]} />
        );

        // Buy hints -> kicks off the hint-2 scramble animation
        rerender(<CipherText text={WORD} cipherText={CIPHER_L2} visible={false} hintLevel={3} guesses={GUESSES} />);
        await flush(2000);
        expect(container.textContent).not.toBe(WORD);

        // Word is solved -> visible flips true
        rerender(<CipherText text={WORD} cipherText={CIPHER_L2} visible={true} hintLevel={3} guesses={GUESSES} />);
        await flush(2000);

        expect(container.textContent).toBe(WORD);
    });

    it('shows the full word when solved WHILE the scramble is still animating', async () => {
        const { container, rerender } = render(
            <CipherText text={WORD} cipherText={CIPHER_L0} visible={false} hintLevel={0} guesses={[]} />
        );

        rerender(<CipherText text={WORD} cipherText={CIPHER_L2} visible={false} hintLevel={3} guesses={GUESSES} />);
        // Solve 300ms in (the daily game's submit delay) - mid-shuffle
        await flush(300);
        rerender(<CipherText text={WORD} cipherText={CIPHER_L2} visible={true} hintLevel={3} guesses={GUESSES} />);
        await flush(3000);

        expect(container.textContent).toBe(WORD);
    });
});
