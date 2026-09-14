import { describe, expect, it } from 'vitest';
import {
    DEFAULT_SETTLE_POLICY,
    MAX_SETTLE_DELAY_MS,
    MIN_SETTLE_INTERVAL_MS,
    parseSettlePolicy,
} from './settlePolicy';
import { MAX_HINT_LEVEL, SETTLE } from '@/lib/gameConfig';

describe('parseSettlePolicy', () => {
    it('falls back to the compiled defaults for anything that is not an object', () => {
        for (const value of [null, undefined, 'settle', 7, []]) {
            expect(parseSettlePolicy(value)).toEqual(DEFAULT_SETTLE_POLICY);
        }
    });

    it('reads an empty object as the compiled defaults', () => {
        // The seeded row is `{}` precisely so it cannot drift from gameConfig.
        expect(parseSettlePolicy({})).toEqual(DEFAULT_SETTLE_POLICY);
    });

    it('defaults to offered, so the game speaks first', () => {
        expect(DEFAULT_SETTLE_POLICY.mode).toBe('offered');
        expect(SETTLE.MODE).toBe('offered');
    });

    it('falls back per field rather than wholesale', () => {
        const parsed = parseSettlePolicy({ mode: 'auto', order: 'nonsense' });

        expect(parsed.mode).toBe('auto');
        expect(parsed.order).toBe(DEFAULT_SETTLE_POLICY.order);
        expect(parsed.intervalMs).toBe(DEFAULT_SETTLE_POLICY.intervalMs);
    });

    it('takes every valid mode and order', () => {
        expect(parseSettlePolicy({ mode: 'off' }).mode).toBe('off');
        expect(parseSettlePolicy({ mode: 'auto' }).mode).toBe('auto');
        expect(parseSettlePolicy({ order: 'left-to-right' }).order).toBe('left-to-right');
        expect(parseSettlePolicy({ order: 'rare-first' }).order).toBe('rare-first');
    });

    it('clamps the interval so letters cannot machine-gun in', () => {
        expect(parseSettlePolicy({ intervalMs: 1 }).intervalMs).toBe(MIN_SETTLE_INTERVAL_MS);
        expect(parseSettlePolicy({ intervalMs: 1e9 }).intervalMs).toBe(MAX_SETTLE_DELAY_MS);
    });

    it('clamps the fraction to a real share of a word', () => {
        expect(parseSettlePolicy({ maxFraction: -1 }).maxFraction).toBe(0);
        expect(parseSettlePolicy({ maxFraction: 4 }).maxFraction).toBe(1);
    });

    it('clamps the arming level to the ladder', () => {
        expect(parseSettlePolicy({ armFromHintLevel: -3 }).armFromHintLevel).toBe(0);
        expect(parseSettlePolicy({ armFromHintLevel: 99 }).armFromHintLevel).toBe(3);
    });

    it('stores null as the pool-only rule rather than reading it as absent', () => {
        // The one field where null is a value: it means "positions only, never
        // new letters". It is also the shipped default, so an absent key must
        // land in the same place rather than on some number.
        expect(parseSettlePolicy({ revealFromHintLevel: null }).revealFromHintLevel).toBeNull();
        expect(parseSettlePolicy({}).revealFromHintLevel)
            .toBe(DEFAULT_SETTLE_POLICY.revealFromHintLevel);
    });

    it('clamps the reveal level to the ladder, and ignores nonsense', () => {
        expect(parseSettlePolicy({ revealFromHintLevel: 99 }).revealFromHintLevel)
            .toBe(MAX_HINT_LEVEL);
        expect(parseSettlePolicy({ revealFromHintLevel: -4 }).revealFromHintLevel).toBe(0);
        expect(parseSettlePolicy({ revealFromHintLevel: 'clue' }).revealFromHintLevel)
            .toBe(DEFAULT_SETTLE_POLICY.revealFromHintLevel);
    });

    it('clamps the clue price to a share of the word', () => {
        expect(parseSettlePolicy({ clueCost: -1 }).clueCost).toBe(0);
        expect(parseSettlePolicy({ clueCost: 3 }).clueCost).toBe(1);
        expect(parseSettlePolicy({ clueCost: 'free' }).clueCost).toBe(DEFAULT_SETTLE_POLICY.clueCost);
    });

    it('reads the price switch as a boolean and nothing else', () => {
        expect(parseSettlePolicy({ showPrices: false }).showPrices).toBe(false);
        expect(parseSettlePolicy({ showPrices: 'no' }).showPrices).toBe(DEFAULT_SETTLE_POLICY.showPrices);
    });

    it('reads the stuck offer clock, clamped like the drip delays', () => {
        const parsed = parseSettlePolicy({
            stuckFirstOfferMs: 6_000,
            stuckSecondOfferMs: 15_000,
            stuckStrikeWorthMs: 4_000,
        });

        expect(parsed.stuckFirstOfferMs).toBe(6_000);
        expect(parsed.stuckSecondOfferMs).toBe(15_000);
        expect(parsed.stuckStrikeWorthMs).toBe(4_000);

        expect(parseSettlePolicy({ stuckFirstOfferMs: -5 }).stuckFirstOfferMs).toBe(0);
        expect(parseSettlePolicy({ stuckStrikeWorthMs: 1e9 }).stuckStrikeWorthMs)
            .toBe(MAX_SETTLE_DELAY_MS);
        expect(parseSettlePolicy({ stuckFirstOfferMs: 'soon' }).stuckFirstOfferMs)
            .toBe(DEFAULT_SETTLE_POLICY.stuckFirstOfferMs);
    });

    it('never stores the route ahead of the reason', () => {
        // A second offer below the first would put the ladder before the
        // encouragement. It is lifted to meet the first, which skips the
        // encouragement instead -- a legitimate setting in its own right.
        const parsed = parseSettlePolicy({ stuckFirstOfferMs: 30_000, stuckSecondOfferMs: 5_000 });

        expect(parsed.stuckSecondOfferMs).toBe(30_000);
        expect(parseSettlePolicy({ stuckFirstOfferMs: 60_000 }).stuckSecondOfferMs).toBe(60_000);
    });

    it('never throws, whatever is in the column', () => {
        expect(() => parseSettlePolicy({
            mode: {},
            intervalMs: 'soon',
            maxFraction: NaN,
            minUnsettled: Infinity,
            order: 42,
            costPerLetter: null,
            clueCost: [],
            showPrices: 1,
        })).not.toThrow();

        expect(parseSettlePolicy({ intervalMs: NaN })).toEqual(DEFAULT_SETTLE_POLICY);
    });
});
