import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const translate = (key: string, values?: Record<string, unknown>) =>
    `${key}:${JSON.stringify(values ?? {})}`;
vi.mock('next-intl', () => ({ useTranslations: () => translate }));

const reducedMotion = { value: false };
vi.mock('framer-motion', async () => {
    const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
    return { ...actual, useReducedMotion: () => reducedMotion.value };
});

import { STREAK_MULTIPLIER } from '@/lib/gameConfig';
import { SolveBurst } from './SolveBurst';

const base = {
    points: 18,
    tier: 'clean' as const,
    streakStep: 0,
    intensity: 0.85,
    flourish: 1,
    withSparks: true,
};

function sparkCount(container: HTMLElement) {
    return container.querySelectorAll('span.rounded-full.h-1\\.5').length;
}

describe('SolveBurst', () => {
    it('shows the points earned', () => {
        render(<SolveBurst {...base} />);
        expect(screen.getByText('+18')).toBeDefined();
    });

    it('shows the multiplier only while a streak is running', () => {
        const { container, rerender } = render(<SolveBurst {...base} />);
        expect(container.textContent).not.toContain(String(STREAK_MULTIPLIER));

        rerender(<SolveBurst {...base} streakStep={2} />);
        expect(container.textContent).toContain(String(STREAK_MULTIPLIER));
    });

    it('announces the solve once, for screen readers', () => {
        render(<SolveBurst {...base} />);
        const status = screen.getByRole('status');

        expect(status.textContent).toContain('burst_announce');
        expect(status.textContent).toContain('18');
    });

    it('announces the streak bonus when one is running', () => {
        render(<SolveBurst {...base} streakStep={3} />);
        expect(screen.getByRole('status').textContent).toContain('burst_announce_streak');
    });

    it('emits no sparks when the policy excludes the tier', () => {
        const { container } = render(<SolveBurst {...base} withSparks={false} />);
        expect(sparkCount(container)).toBe(0);
    });

    it('emits sparks when the policy allows them', () => {
        const { container } = render(<SolveBurst {...base} />);
        expect(sparkCount(container)).toBeGreaterThan(0);
    });

    /**
     * Reduced motion drops the particles rather than shortening them, but must
     * not drop the information: the number, the chip and the announcement all
     * still have to be there, or the tier would be carried by motion alone.
     */
    it('drops the sparks but keeps the information under reduced motion', () => {
        reducedMotion.value = true;
        try {
            const { container } = render(<SolveBurst {...base} streakStep={2} />);

            expect(sparkCount(container)).toBe(0);
            expect(screen.getByText('+18')).toBeDefined();
            expect(container.textContent).toContain(String(STREAK_MULTIPLIER));
            expect(screen.getByRole('status')).toBeDefined();
        } finally {
            reducedMotion.value = false;
        }
    });

    // The bubble underneath already says the word was solved; a floating "+18"
    // read out as well would announce every solve twice.
    it('hides the decoration from assistive tech', () => {
        const { container } = render(<SolveBurst {...base} />);
        expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    });
});
