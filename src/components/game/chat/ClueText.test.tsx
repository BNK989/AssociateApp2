import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ClueText } from './ClueText';
import { CLUE_SIGNS, DECODE_BUDGET_MS } from '@/lib/clueDecode';

vi.mock('framer-motion', () => ({ useReducedMotion: () => false }));

const CLUE = 'A low, throaty sound.';
const GLYPHS = new Set(CLUE_SIGNS);

/** The spans that hold the flow: one per word, always the finished text. */
function sizingText(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll('span.relative.inline-block > span:first-child'))
        .map((el) => el.textContent ?? '');
}

/** The spans painted over them: one per word still masked. */
function overlays(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll('span.absolute'));
}

describe('ClueText', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('carries the settled clue as its label, never the glyphs', () => {
        render(<ClueText text={CLUE} />);

        expect(screen.getByLabelText(CLUE)).toBeTruthy();
    });

    it('lays every word out at its finished width from the first frame', () => {
        const { container } = render(<ClueText text={CLUE} />);

        // Masked: the real words are in the flow, just not visible.
        expect(sizingText(container)).toEqual(['A', 'low', 'throaty', 'sound']);
        expect(overlays(container).length).toBeGreaterThan(0);

        act(() => { vi.advanceTimersByTime(DECODE_BUDGET_MS * 2); });

        // Decoded: the same boxes, the same words, nothing painted over them.
        expect(sizingText(container)).toEqual(['A', 'low', 'throaty', 'sound']);
        expect(overlays(container)).toHaveLength(0);
    });

    it('masks with clue signs and keeps the punctuation that shapes the line', () => {
        const { container } = render(<ClueText text={CLUE} />);

        for (const overlay of overlays(container)) {
            for (const char of Array.from(overlay.textContent ?? '')) {
                expect(GLYPHS.has(char)).toBe(true);
            }
        }

        expect(container.textContent).toContain(',');
        expect(container.textContent).toContain('.');
    });

    it('hands a reader the clue itself, with the animation hidden from them', () => {
        const { container } = render(<ClueText text={CLUE} />);
        const labelled = screen.getByLabelText(CLUE);

        expect(labelled.querySelector('[aria-hidden="true"]')).toBeTruthy();
        expect(overlays(container).every((el) => el.closest('[aria-hidden="true"]'))).toBe(true);
    });
});
