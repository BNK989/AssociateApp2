import { SETTLE } from '@/lib/gameConfig';
import { MAX_HINT_LEVEL } from '@/lib/gameConfig';

/**
 * How the settle drip behaves, as a game master can tune it.
 *
 * Same contract as `hintPolicy`, `feedbackPolicy` and `letterPoolPolicy`: a
 * total parser with a per-field fallback to the compiled constants, so an
 * absent or malformed `settle` row degrades to today's behaviour rather than
 * taking the board down.
 */

/**
 * How the drip starts.
 *
 * - `off`: the rung does not exist. The stuck ladder falls through to the
 *   reveal exactly as it did before.
 * - `offered`: the game offers and the player accepts. The first letter lands
 *   on acceptance, which is what makes accepting feel like a reward rather than
 *   the start of a wait.
 * - `auto`: letters land unasked once the dwell clock runs out.
 */
export type SettleMode = 'off' | 'offered' | 'auto';

export const SETTLE_MODES: readonly SettleMode[] = ['off', 'offered', 'auto'] as const;

/**
 * Which letter goes next.
 *
 * - `left-to-right`: the first unsettled letter. The strongest hint per letter,
 *   because word openings carry the most information — which is also why it
 *   burns the ceiling fastest and turns three letters into a near-reveal.
 * - `seeded`: a fixed shuffle, deterministic per word. Spreads the constraint
 *   across the word so each letter is worth less and the ceiling goes further.
 * - `rare-first`: the least common letter first, for maximum deduction per
 *   letter — a settled Q or X narrows the word far more than a settled E.
 */
export type SettleOrder = 'left-to-right' | 'seeded' | 'rare-first';

export const SETTLE_ORDERS: readonly SettleOrder[] = [
    'left-to-right',
    'seeded',
    'rare-first',
] as const;

export type SettlePolicy = {
    mode: SettleMode;
    /** Lowest hint level the drip arms on. */
    armFromHintLevel: number;
    /**
     * Lowest hint level at which the drip may open a letter the player has not
     * been shown, rather than only place one that is already loose.
     *
     * `null`, the default, is the founding rule: positions only, never new
     * letters. It relies on hint 2 filling the pool with orange letters, which
     * it does — see `SETTLE.REVEAL_FROM_HINT_LEVEL` for the one day it did not.
     */
    revealFromHintLevel: number | null;
    /** Dwell before the first letter. `auto` only; `offered` uses the stuck clock. */
    firstDelayMs: number;
    /** Gap between letters, in both modes. */
    intervalMs: number;
    /** Dwell credit for a wrong guess. `auto` only, mirroring the stuck offer. */
    strikeCreditMs: number;
    /** Ceiling on the share of the word that may settle, 0–1. */
    maxFraction: number;
    /** Letters that must be left for the player whatever the fraction allows. */
    minUnsettled: number;
    order: SettleOrder;
    /** Fraction of base value forfeited per settled letter. */
    costPerLetter: number;
    /** Fraction of base value the written clue costs, on top of `HINT_COSTS.TIER_3`. */
    clueCost: number;
    /** Whether the fork at hint level 2 quotes each option's price. */
    showPrices: boolean;
    /**
     * The stuck offer's clock: dwell before the bar first speaks, dwell before
     * it escalates from a reason to a route, and what a wrong guess is worth on
     * it. Not the drip's clock -- the offer exists in every mode, `off`
     * included -- but stored here because the offer is how the drip is reached,
     * and the settle row already travels to the board.
     */
    stuckFirstOfferMs: number;
    stuckSecondOfferMs: number;
    stuckStrikeWorthMs: number;
};

/** The policy that reproduces the behaviour compiled into `gameConfig.ts`. */
export const DEFAULT_SETTLE_POLICY: SettlePolicy = {
    mode: SETTLE.MODE as SettleMode,
    armFromHintLevel: SETTLE.ARM_FROM_HINT_LEVEL,
    revealFromHintLevel: SETTLE.REVEAL_FROM_HINT_LEVEL,
    firstDelayMs: SETTLE.FIRST_DELAY_MS,
    intervalMs: SETTLE.INTERVAL_MS,
    strikeCreditMs: SETTLE.STRIKE_CREDIT_MS,
    maxFraction: SETTLE.MAX_FRACTION,
    minUnsettled: SETTLE.MIN_UNSETTLED,
    order: SETTLE.ORDER as SettleOrder,
    costPerLetter: SETTLE.COST_PER_LETTER,
    clueCost: SETTLE.CLUE_COST,
    showPrices: SETTLE.SHOW_PRICES,
    stuckFirstOfferMs: SETTLE.STUCK_FIRST_OFFER_MS,
    stuckSecondOfferMs: SETTLE.STUCK_SECOND_OFFER_MS,
    stuckStrikeWorthMs: SETTLE.STUCK_STRIKE_WORTH_MS,
};

/**
 * Longest gap the panel will store.
 *
 * Ten minutes, matching `MAX_RUNG_DELAY_SECONDS`. Past that the letter never
 * arrives within a sitting, which is indistinguishable from `off` except that
 * the panel claims otherwise.
 */
export const MAX_SETTLE_DELAY_MS = 600_000;

/** Shortest gap the panel will store, so letters cannot machine-gun in. */
export const MIN_SETTLE_INTERVAL_MS = 2_000;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, value));
}

function parseEnum<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
    return typeof raw === 'string' && (allowed as readonly string[]).includes(raw)
        ? (raw as T)
        : fallback;
}

/**
 * The one field where `null` is a value rather than an absence: it stores the
 * pool-only rule. It is also the compiled default, so an absent or malformed
 * key lands there too; a number is a game master opening the drip from that
 * level, clamped to the ladder.
 */
function parseRevealLevel(raw: unknown): number | null {
    if (raw === null) return null;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        return DEFAULT_SETTLE_POLICY.revealFromHintLevel;
    }
    return Math.round(clampNumber(raw, 0, MAX_HINT_LEVEL, 0));
}

/**
 * Narrows a stored jsonb blob into a policy, per field.
 *
 * Total by construction: it never throws and never returns a partial object.
 * An absent field falls back to the compiled constant rather than to a
 * spelled-out copy of the defaults, which is why the seeded row is `{}` — it
 * cannot drift from `gameConfig.ts` the way a duplicated default would.
 */
export function parseSettlePolicy(value: unknown): SettlePolicy {
    if (!isRecord(value)) return { ...DEFAULT_SETTLE_POLICY };

    const stuckFirstOfferMs = Math.round(clampNumber(
        value.stuckFirstOfferMs, 0, MAX_SETTLE_DELAY_MS, DEFAULT_SETTLE_POLICY.stuckFirstOfferMs,
    ));

    return {
        mode: parseEnum(value.mode, SETTLE_MODES, DEFAULT_SETTLE_POLICY.mode),
        armFromHintLevel: Math.round(clampNumber(
            value.armFromHintLevel, 0, MAX_HINT_LEVEL, DEFAULT_SETTLE_POLICY.armFromHintLevel,
        )),
        revealFromHintLevel: parseRevealLevel(value.revealFromHintLevel),
        firstDelayMs: Math.round(clampNumber(
            value.firstDelayMs, 0, MAX_SETTLE_DELAY_MS, DEFAULT_SETTLE_POLICY.firstDelayMs,
        )),
        intervalMs: Math.round(clampNumber(
            value.intervalMs,
            MIN_SETTLE_INTERVAL_MS,
            MAX_SETTLE_DELAY_MS,
            DEFAULT_SETTLE_POLICY.intervalMs,
        )),
        strikeCreditMs: Math.round(clampNumber(
            value.strikeCreditMs, 0, MAX_SETTLE_DELAY_MS, DEFAULT_SETTLE_POLICY.strikeCreditMs,
        )),
        maxFraction: clampNumber(value.maxFraction, 0, 1, DEFAULT_SETTLE_POLICY.maxFraction),
        // No upper bound worth naming: a floor larger than the word simply
        // means nothing settles, which `settleAllowance` already reports as 0.
        minUnsettled: Math.round(clampNumber(
            value.minUnsettled, 0, 64, DEFAULT_SETTLE_POLICY.minUnsettled,
        )),
        order: parseEnum(value.order, SETTLE_ORDERS, DEFAULT_SETTLE_POLICY.order),
        costPerLetter: clampNumber(value.costPerLetter, 0, 1, DEFAULT_SETTLE_POLICY.costPerLetter),
        clueCost: clampNumber(value.clueCost, 0, 1, DEFAULT_SETTLE_POLICY.clueCost),
        showPrices: typeof value.showPrices === 'boolean'
            ? value.showPrices
            : DEFAULT_SETTLE_POLICY.showPrices,
        stuckFirstOfferMs,
        // The route cannot come before the reason: a second offer stored below
        // the first is lifted to meet it, which skips the reason rather than
        // reordering the ladder.
        stuckSecondOfferMs: Math.max(stuckFirstOfferMs, Math.round(clampNumber(
            value.stuckSecondOfferMs, 0, MAX_SETTLE_DELAY_MS, DEFAULT_SETTLE_POLICY.stuckSecondOfferMs,
        ))),
        stuckStrikeWorthMs: Math.round(clampNumber(
            value.stuckStrikeWorthMs, 0, MAX_SETTLE_DELAY_MS, DEFAULT_SETTLE_POLICY.stuckStrikeWorthMs,
        )),
    };
}
