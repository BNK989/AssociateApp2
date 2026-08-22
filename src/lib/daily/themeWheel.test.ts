import { describe, it, expect } from 'vitest';
import {
    ANGLES,
    DOMAINS,
    WEEKDAY_PLANS,
    daysSinceEpoch,
    planForDate,
} from './themeWheel';

/** Walks forward from a start date, yielding ISO day strings. */
function dateRange(start: string, count: number): string[] {
    const [y, m, d] = start.split('-').map(Number);
    const out: string[] = [];

    for (let i = 0; i < count; i++) {
        const date = new Date(Date.UTC(y, m - 1, d + i));
        out.push(date.toISOString().slice(0, 10));
    }

    return out;
}

describe('planForDate', () => {
    it('is deterministic: the same date always plans the same puzzle', () => {
        expect(planForDate('2026-09-14')).toEqual(planForDate('2026-09-14'));
    });

    it('draws a domain and angle from the published lists', () => {
        for (const date of dateRange('2026-08-23', 60)) {
            const plan = planForDate(date);
            expect(DOMAINS).toContain(plan.domain);
            expect(ANGLES).toContain(plan.angle);
        }
    });

    it('applies the weekday plan for the day it falls on', () => {
        // 2026-08-24 is a Monday.
        const monday = planForDate('2026-08-24');
        expect(monday.weekday).toBe(1);
        expect(monday.words).toBe(WEEKDAY_PLANS[1].words);

        // 2026-08-29 is a Saturday, the long one.
        const saturday = planForDate('2026-08-29');
        expect(saturday.weekday).toBe(6);
        expect(saturday.words).toBe(WEEKDAY_PLANS[6].words);
        expect(saturday.words).toBeGreaterThan(monday.words);
    });

    it('never repeats a domain on consecutive days', () => {
        const dates = dateRange('2026-01-01', 800);
        const domains = dates.map((d) => planForDate(d).domain);

        for (let i = 1; i < domains.length; i++) {
            expect(domains[i], `repeat on ${dates[i]}`).not.toBe(domains[i - 1]);
        }
    });

    it('uses every domain exactly once per cycle, so none is starved', () => {
        const dates = dateRange('2026-01-01', DOMAINS.length);
        const domains = dates.map((d) => planForDate(d).domain);

        expect(new Set(domains).size).toBe(DOMAINS.length);
    });

    it('spreads domains evenly over a long run', () => {
        const counts = new Map<string, number>();

        for (const date of dateRange('2026-01-01', DOMAINS.length * 20)) {
            const { domain } = planForDate(date);
            counts.set(domain, (counts.get(domain) ?? 0) + 1);
        }

        expect(counts.size).toBe(DOMAINS.length);
        for (const count of counts.values()) {
            expect(count).toBe(20);
        }
    });

    it('does not lock a domain to the same weekday', () => {
        const weekdaysSeen = new Map<string, Set<number>>();

        for (const date of dateRange('2026-01-01', 400)) {
            const { domain, weekday } = planForDate(date);
            if (!weekdaysSeen.has(domain)) weekdaysSeen.set(domain, new Set());
            weekdaysSeen.get(domain)!.add(weekday);
        }

        // Every domain should have landed on several different weekdays,
        // otherwise a domain would always arrive at one difficulty.
        for (const days of weekdaysSeen.values()) {
            expect(days.size).toBeGreaterThan(2);
        }
    });

    it('makes a domain sit out several days before it returns', () => {
        const dates = dateRange('2026-01-01', 800);
        const lastSeen = new Map<string, number>();
        let soonestReturn = Infinity;

        dates.forEach((date, index) => {
            const { domain } = planForDate(date);
            const previous = lastSeen.get(domain);
            if (previous !== undefined) {
                soonestReturn = Math.min(soonestReturn, index - previous);
            }
            lastSeen.set(domain, index);
        });

        // Within a cycle a domain appears once, so the only way it can come
        // back quickly is across a cycle boundary -- which is the seam the
        // gap logic exists to close.
        expect(soonestReturn).toBeGreaterThanOrEqual(5);
    });

    it('orders the connection band so it is a band', () => {
        for (const plan of Object.values(WEEKDAY_PLANS)) {
            expect(plan.minConnection).toBeLessThan(plan.maxConnection);
            expect(plan.minConnection).toBeGreaterThanOrEqual(0.5);
            expect(plan.maxConnection).toBeLessThanOrEqual(1.0);
        }
    });

    it('gets harder and longer as the week goes on', () => {
        const weekdays = [1, 2, 3, 4, 5, 6];
        const lengths = weekdays.map((d) => WEEKDAY_PLANS[d].words);
        const tightness = weekdays.map((d) => WEEKDAY_PLANS[d].minConnection);

        for (let i = 1; i < lengths.length; i++) {
            expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1]);
            expect(tightness[i]).toBeLessThanOrEqual(tightness[i - 1]);
        }
    });
});

describe('daysSinceEpoch', () => {
    it('counts whole days regardless of month and year boundaries', () => {
        expect(daysSinceEpoch('2026-01-02') - daysSinceEpoch('2026-01-01')).toBe(1);
        expect(daysSinceEpoch('2027-01-01') - daysSinceEpoch('2026-01-01')).toBe(365);
        expect(daysSinceEpoch('2026-03-01') - daysSinceEpoch('2026-02-28')).toBe(1);
    });
});
