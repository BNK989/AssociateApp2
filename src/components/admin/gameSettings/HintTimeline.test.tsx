import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { DEFAULT_HINT_POLICY, type DailyHintPolicy } from '@/lib/daily/hintPolicy';
import { HintTimeline } from './HintTimeline';

afterEach(() => cleanup());

function policy(overrides: Partial<DailyHintPolicy>): DailyHintPolicy {
    return {
        ...DEFAULT_HINT_POLICY,
        rungs: [
            { auto: true, delaySeconds: 20 },
            { auto: true, delaySeconds: 20 },
            { auto: true, delaySeconds: 8 },
        ],
        ...overrides,
    };
}

/**
 * The timings themselves are `previewTimeline`'s and are tested there. What is
 * left is that the panel draws every timeline the policy produces — a chain
 * whose first word opens hinted and whose later words do not has two, and
 * showing only the first is how the preview came to promise players a scramble
 * they never got.
 */
describe('HintTimeline', () => {
    it('draws one track when every word opens the same way', () => {
        render(<HintTimeline policy={policy({ startLevel: 2, startLevelAppliesTo: 'every-word' })} />);

        expect(screen.getByText('Every word')).toBeTruthy();
        expect(screen.queryByText('Every word after it')).toBeNull();
        expect(screen.getByText('Scramble')).toBeTruthy();
        expect(screen.getByText('immediately')).toBeTruthy();
    });

    it('draws both tracks when the start level reaches only the first word', () => {
        render(<HintTimeline policy={policy({ startLevel: 2, startLevelAppliesTo: 'first-word' })} />);

        expect(screen.getByText('The first word they play')).toBeTruthy();
        expect(screen.getByText('Every word after it')).toBeTruthy();

        // The later track climbs from nothing: first letter at 20s, scramble at
        // 40s. Without it the panel would only ever show the immediate scramble.
        expect(screen.getByText('20s')).toBeTruthy();
        expect(screen.getByText('40s')).toBeTruthy();
    });

    it('keeps a single track when nothing is given away up front', () => {
        render(<HintTimeline policy={policy({ startLevel: 0, startLevelAppliesTo: 'first-word' })} />);

        expect(screen.getByText('Every word')).toBeTruthy();
        expect(screen.queryByText('Every word after it')).toBeNull();
    });

    it('says so when a manual-only rung ends the ladder', () => {
        render(<HintTimeline
            policy={policy({
                startLevel: 0,
                rungs: [
                    { auto: true, delaySeconds: 20 },
                    { auto: false, delaySeconds: 20 },
                    { auto: true, delaySeconds: 8 },
                ],
            })}
        />);

        expect(screen.getByText('manual only')).toBeTruthy();
        expect(screen.getByText(/The ladder stops there/)).toBeTruthy();
    });
});
