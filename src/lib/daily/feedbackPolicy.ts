import { REWARD_FEEDBACK } from '@/lib/gameConfig';
import { SOLVE_TIERS, tierAtLeast, type SolveTier } from './feedbackTiers';

/**
 * How rewarding a correct guess feels, as a game master can tune it.
 *
 * Mirrors `hintPolicy.ts` in shape and in contract: a total parser with a
 * per-field fallback to the compiled constants, so a malformed or absent
 * `daily_feedback` row degrades to today's behaviour rather than taking the
 * daily game down.
 */

/** Lowest solve tier that earns a particle burst; `off` disables bursts. */
export type BurstThreshold = SolveTier | 'off';

export const BURST_THRESHOLDS: readonly BurstThreshold[] = ['off', ...SOLVE_TIERS] as const;

export type DailyFeedbackPolicy = {
    /** Master switch for reward audio. A player's own mute still wins. */
    soundEnabled: boolean;
    /** Ceiling on how loud reward audio may play, 0–1. */
    volume: number;
    /** Whether a running streak transposes the chime up the pentatonic ladder. */
    streakPitch: boolean;
    /** A short, quiet descending tone on a wrong guess. */
    missSound: boolean;
    burstFrom: BurstThreshold;
    /** Scales the size and travel of every solve flourish, 0–1. */
    flourish: number;
    /** Short vibration on devices that support it. */
    haptics: boolean;
};

function isBurstThreshold(value: unknown): value is BurstThreshold {
    return typeof value === 'string' && (BURST_THRESHOLDS as readonly string[]).includes(value);
}

/** The policy that reproduces the behaviour compiled into `gameConfig.ts`. */
export const DEFAULT_FEEDBACK_POLICY: DailyFeedbackPolicy = {
    soundEnabled: REWARD_FEEDBACK.SOUND_ENABLED,
    volume: REWARD_FEEDBACK.VOLUME,
    streakPitch: REWARD_FEEDBACK.STREAK_PITCH,
    missSound: REWARD_FEEDBACK.MISS_SOUND,
    burstFrom: isBurstThreshold(REWARD_FEEDBACK.BURST_FROM) ? REWARD_FEEDBACK.BURST_FROM : 'solid',
    flourish: REWARD_FEEDBACK.FLOURISH,
    haptics: REWARD_FEEDBACK.HAPTICS,
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bool(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

/** Clamps a stored 0–1 number, falling back rather than passing NaN downstream. */
export function unitScalar(value: unknown, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.max(0, Math.min(1, value));
}

/**
 * Narrows a stored jsonb blob into a policy, per field.
 *
 * An absent field falls back to the compiled constant rather than to a
 * spelled-out copy of the defaults, which is why the seeded row is `{}`: it
 * cannot drift from `gameConfig.ts` the way a duplicated default would.
 */
export function parseFeedbackPolicy(value: unknown): DailyFeedbackPolicy {
    if (!isRecord(value)) return DEFAULT_FEEDBACK_POLICY;

    return {
        soundEnabled: bool(value.soundEnabled, DEFAULT_FEEDBACK_POLICY.soundEnabled),
        volume: unitScalar(value.volume, DEFAULT_FEEDBACK_POLICY.volume),
        streakPitch: bool(value.streakPitch, DEFAULT_FEEDBACK_POLICY.streakPitch),
        missSound: bool(value.missSound, DEFAULT_FEEDBACK_POLICY.missSound),
        burstFrom: isBurstThreshold(value.burstFrom)
            ? value.burstFrom
            : DEFAULT_FEEDBACK_POLICY.burstFrom,
        flourish: unitScalar(value.flourish, DEFAULT_FEEDBACK_POLICY.flourish),
        haptics: bool(value.haptics, DEFAULT_FEEDBACK_POLICY.haptics),
    };
}

/** What a player may set for themselves, from the info screen. */
export type PlayerFeedbackPreferences = {
    /** `enable_audio_chime`. Absent means "never touched it", which is on. */
    soundEnabled?: boolean;
    /** `audio_volume`, 0–1. Absent means "use whatever the game master set". */
    volume?: number;
};

/**
 * The policy this player actually plays under.
 *
 * Two rules, and the asymmetry between them is deliberate:
 *
 * - **A player's mute always wins.** Unlike the hint policy, there is no
 *   `force` scope for sound. Audio that a player has switched off must stay off
 *   — a game master tuning reward feel has no business overriding that, and a
 *   site that plays sound at someone who muted it is a site they leave.
 * - **A player's volume scales the game master's ceiling**, rather than
 *   replacing it. Turning the master volume down still turns everybody down.
 */
export function resolveFeedbackPolicy(
    gameMaster: DailyFeedbackPolicy,
    player: PlayerFeedbackPreferences = {},
): DailyFeedbackPolicy {
    const playerWantsSound = player.soundEnabled !== false;
    const playerVolume = unitScalar(player.volume, 1);

    return {
        ...gameMaster,
        soundEnabled: gameMaster.soundEnabled && playerWantsSound,
        volume: gameMaster.volume * playerVolume,
    };
}

/** Whether a solve of this tier earns a particle burst under `policy`. */
export function shouldBurst(policy: DailyFeedbackPolicy, tier: SolveTier): boolean {
    if (policy.burstFrom === 'off' || policy.flourish === 0) return false;
    return tierAtLeast(tier, policy.burstFrom);
}
