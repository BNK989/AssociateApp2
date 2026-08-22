import { describe, expect, it } from 'vitest';
import { DEFAULT_HINT_POLICY, type DailyHintPolicy } from './hintPolicy';
import {
    isDue,
    MIN_REVEAL_SPACING_MS,
    progressPercent,
    revealSchedule,
    secondsUntil,
} from './hintSchedule';

const T0 = 1_000_000;

function policy(overrides: Partial<DailyHintPolicy> = {}): DailyHintPolicy {
    return {
        ...DEFAULT_HINT_POLICY,
        rungs: [
            { auto: true, delaySeconds: 15 },
            { auto: true, delaySeconds: 30 },
            { auto: true, delaySeconds: 60 },
        ],
        ...overrides,
    };
}

function scheduleAt(p: DailyHintPolicy, currentLevel: number, opts: {
    wordOpenedAt?: number;
    rungArmedAt?: number;
    lastRevealAt?: number | null;
} = {}) {
    return revealSchedule({
        policy: p,
        currentLevel,
        wordOpenedAt: opts.wordOpenedAt ?? T0,
        rungArmedAt: opts.rungArmedAt ?? T0,
        lastRevealAt: opts.lastRevealAt ?? null,
    });
}

describe('revealSchedule — per-rung', () => {
    const p = policy({ stagger: 'per-rung' });

    // 15/30/60 as gaps means the third hint lands at 105s, not 60s.
    it('measures each delay from the previous reveal', () => {
        expect(scheduleAt(p, 0)?.deadline).toBe(T0 + 15_000);

        const afterFirst = scheduleAt(p, 1, { rungArmedAt: T0 + 15_000, lastRevealAt: T0 + 15_000 });
        expect(afterFirst?.deadline).toBe(T0 + 45_000);

        const afterSecond = scheduleAt(p, 2, { rungArmedAt: T0 + 45_000, lastRevealAt: T0 + 45_000 });
        expect(afterSecond?.deadline).toBe(T0 + 105_000);
    });

    it('ignores when the word opened once a rung has armed later', () => {
        const s = scheduleAt(p, 1, { wordOpenedAt: T0, rungArmedAt: T0 + 50_000, lastRevealAt: T0 + 50_000 });
        expect(s?.deadline).toBe(T0 + 80_000);
    });
});

describe('revealSchedule — cumulative', () => {
    const p = policy({ stagger: 'cumulative' });

    // The same 15/30/60 read as offsets: everything is out by one minute.
    it('measures every delay from the word opening', () => {
        expect(scheduleAt(p, 0)?.deadline).toBe(T0 + 15_000);
        expect(scheduleAt(p, 1, { rungArmedAt: T0 + 15_000, lastRevealAt: T0 + 15_000 })?.deadline)
            .toBe(T0 + 30_000);
        expect(scheduleAt(p, 2, { rungArmedAt: T0 + 30_000, lastRevealAt: T0 + 30_000 })?.deadline)
            .toBe(T0 + 60_000);
    });

    // A manual hint does not push the remaining schedule back, which is the
    // point of cumulative: the promise is "all hints out by 60s" regardless.
    it('keeps the same targets when a player takes a hint early', () => {
        const s = scheduleAt(p, 1, { wordOpenedAt: T0, rungArmedAt: T0 + 2_000, lastRevealAt: null });
        expect(s?.deadline).toBe(T0 + 30_000);
    });

    // A decreasing schedule leaves the next target already past. Firing
    // immediately is predictable; silently rewriting the game master's input
    // would not be.
    it('fires immediately when an earlier rung overshoots a later target', () => {
        const decreasing = policy({
            stagger: 'cumulative',
            rungs: [
                { auto: true, delaySeconds: 30 },
                { auto: true, delaySeconds: 10 },
                { auto: true, delaySeconds: 60 },
            ],
        });

        const s = scheduleAt(decreasing, 1, { rungArmedAt: T0 + 30_000, lastRevealAt: T0 + 30_000 });
        expect(s?.deadline).toBe(T0 + 30_000 + MIN_REVEAL_SPACING_MS);
    });
});

describe('revealSchedule — no reveal coming', () => {
    it('returns null when the master switch is off', () => {
        expect(scheduleAt(policy({ autoEnabled: false }), 0)).toBeNull();
    });

    it('returns null for a manual-only rung', () => {
        const p = policy({
            rungs: [
                { auto: true, delaySeconds: 15 },
                { auto: false, delaySeconds: 30 },
                { auto: true, delaySeconds: 60 },
            ],
        });

        expect(scheduleAt(p, 0)).not.toBeNull();
        expect(scheduleAt(p, 1)).toBeNull();
    });

    it('returns null once the ladder is finished', () => {
        expect(scheduleAt(policy(), 3)).toBeNull();
    });
});

describe('revealSchedule — spacing', () => {
    const instant = policy({
        rungs: [
            { auto: true, delaySeconds: 0 },
            { auto: true, delaySeconds: 0 },
            { auto: true, delaySeconds: 0 },
        ],
    });

    it('fires the first zero-delay reveal without waiting', () => {
        expect(scheduleAt(instant, 0)?.deadline).toBe(T0);
    });

    // All-zero means "give the ladder away at once", but three reveals in one
    // frame reads as a glitch rather than as help.
    it('spaces the rest of a zero-delay burst', () => {
        const s = scheduleAt(instant, 1, { rungArmedAt: T0, lastRevealAt: T0 });
        expect(s?.deadline).toBe(T0 + MIN_REVEAL_SPACING_MS);
    });

    it('does not delay a normal schedule that already clears the spacing', () => {
        const s = scheduleAt(policy(), 1, { rungArmedAt: T0 + 15_000, lastRevealAt: T0 + 15_000 });
        expect(s?.deadline).toBe(T0 + 45_000);
    });
});

describe('secondsUntil', () => {
    it('rounds up so the last partial second still shows', () => {
        const s = { deadline: T0 + 4_200, armedAt: T0 };
        expect(secondsUntil(s, T0)).toBe(5);
        expect(secondsUntil(s, T0 + 4_000)).toBe(1);
    });

    it('never goes negative', () => {
        expect(secondsUntil({ deadline: T0, armedAt: T0 - 1_000 }, T0 + 9_999)).toBe(0);
    });

    it('reports nothing for an absent schedule', () => {
        expect(secondsUntil(null, T0)).toBe(0);
    });
});

describe('progressPercent', () => {
    it('runs from zero to a hundred across the countdown', () => {
        const s = { deadline: T0 + 10_000, armedAt: T0 };

        expect(progressPercent(s, T0)).toBe(0);
        expect(progressPercent(s, T0 + 5_000)).toBe(50);
        expect(progressPercent(s, T0 + 10_000)).toBe(100);
    });

    it('clamps outside the window rather than overshooting the ring', () => {
        const s = { deadline: T0 + 10_000, armedAt: T0 };

        expect(progressPercent(s, T0 - 5_000)).toBe(0);
        expect(progressPercent(s, T0 + 50_000)).toBe(100);
    });

    it('reports a full ring for a zero-length countdown', () => {
        expect(progressPercent({ deadline: T0, armedAt: T0 }, T0)).toBe(100);
    });

    it('reports nothing for an absent schedule', () => {
        expect(progressPercent(null, T0)).toBe(0);
    });
});

describe('isDue', () => {
    it('is due exactly at the deadline', () => {
        const s = { deadline: T0 + 1_000, armedAt: T0 };

        expect(isDue(s, T0 + 999)).toBe(false);
        expect(isDue(s, T0 + 1_000)).toBe(true);
    });

    it('is never due without a schedule', () => {
        expect(isDue(null, Number.MAX_SAFE_INTEGER)).toBe(false);
    });
});
