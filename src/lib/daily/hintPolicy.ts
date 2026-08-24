import { GAME_CONFIG, MAX_HINT_LEVEL } from '@/lib/gameConfig';

/**
 * How the daily game hands out hints.
 *
 * This replaces a scalar model — one delay reused for every rung, plus a single
 * on/off switch — that could not express the schedules a game master actually
 * wants ("first letter free, then wait 45s for the scramble, never auto-give
 * the clue away"). The ladder is now three independent rungs.
 *
 * `DEFAULT_HINT_POLICY` reproduces the pre-policy behaviour exactly, so nothing
 * changes until someone changes it.
 */

/** One step up the ladder: to level 1, then 2, then 3. */
export type HintRung = {
    /** When false the clock never arms; the manual hint button still reaches it. */
    auto: boolean;
    /** Thinking time before this rung fires. Zero fires immediately. */
    delaySeconds: number;
};

/**
 * How rung delays are read.
 *
 * - `per-rung`: delays are *gaps between* reveals — the clock restarts after
 *   each one. 15/30/60 fires at t=15, t=45, t=105.
 * - `cumulative`: delays are offsets from the moment the word opened. 15/30/60
 *   fires at t=15, t=30, t=60 — "every hint is out by a minute" is a sentence
 *   you can reason about without arithmetic.
 *
 * Either way, delays of zero reveal the whole ladder in one burst.
 */
export type HintStagger = 'per-rung' | 'cumulative';

/** `jump` skips the ladder and goes straight to the AI clue. */
export type HintProgression = 'ladder' | 'jump';

/**
 * Which words the start level reaches, and when it is applied to them.
 *
 * - `first-word`: only the word the player faces first.
 * - `every-word`: the whole chain, applied up front — so a player scrolling the
 *   board sees every word already scrambled before reaching it.
 * - `every-word-on-arrival`: the whole chain, but each word is left untouched
 *   until it becomes the active one. Same entitlement, no lookahead.
 *
 * The last two score identically: the level is free (or charged) on every word
 * either way. They differ only in what the board gives away early.
 */
export type StartLevelReach = 'first-word' | 'every-word' | 'every-word-on-arrival';

export const START_LEVEL_REACHES: readonly StartLevelReach[] = [
    'first-word',
    'every-word',
    'every-word-on-arrival',
] as const;

export type DailyHintPolicy = {
    /** Hint level a word is already at when it opens. */
    startLevel: number;
    /** Which words `startLevel` reaches, and whether it is applied up front. */
    startLevelAppliesTo: StartLevelReach;
    /** Whether a hint the player never asked for still costs them points. */
    chargeForStartLevel: boolean;
    /** Master switch for the automatic clock. Manual hints are unaffected. */
    autoEnabled: boolean;
    /** Index 0 governs the climb to level 1, index 1 to level 2, index 2 to level 3. */
    rungs: [HintRung, HintRung, HintRung];
    progression: HintProgression;
    stagger: HintStagger;
    /** What happens to a game already in progress when the policy changes. */
    onRevisionChange: 'keep' | 'restart';
};

/** Longest delay a rung may carry. Beyond this the hint would never arrive. */
export const MAX_RUNG_DELAY_SECONDS = 600;

/**
 * The policy that reproduces the behaviour this codebase had before policies
 * existed: one shared delay on every rung, laddered, restarting after each
 * reveal, with a pre-given hint still charged for.
 */
export const DEFAULT_HINT_POLICY: DailyHintPolicy = {
    startLevel: 0,
    startLevelAppliesTo: 'first-word',
    chargeForStartLevel: true,
    autoEnabled: GAME_CONFIG.DEFAULT_AUTO_HINT_ENABLED,
    rungs: [
        { auto: true, delaySeconds: GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION },
        { auto: true, delaySeconds: GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION },
        { auto: true, delaySeconds: GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION },
    ],
    progression: GAME_CONFIG.DEFAULT_AUTO_HINT_REVEAL_TYPE === 'ALL' ? 'jump' : 'ladder',
    stagger: 'per-rung',
    onRevisionChange: 'keep',
};

/** Which moment a rung's delay is counted from. */
export type ClockOrigin = 'rung-armed' | 'word-opened';

/**
 * The clock the countdown should measure against.
 *
 * Exposed so the timer hook does not re-derive the mapping: it owns *when* to
 * reset its stopwatch, this module owns *what the delay means*.
 */
export function clockOrigin(policy: DailyHintPolicy): ClockOrigin {
    return policy.stagger === 'cumulative' ? 'word-opened' : 'rung-armed';
}

/**
 * Seconds to wait before the next rung fires, or null when it never will —
 * either the ladder is finished, the master switch is off, or this rung is
 * marked manual-only.
 *
 * Under `cumulative` the returned value is an absolute offset from when the
 * word opened, so a player who took a hint manually simply arrives at the next
 * target sooner. A cumulative schedule whose delays decrease (30/10/60) leaves
 * the second target already in the past, which fires it immediately — a burst
 * rather than an error, and it is left that way rather than silently rewritten.
 */
export function autoRevealDelay(policy: DailyHintPolicy, currentLevel: number): number | null {
    if (!policy.autoEnabled) return null;
    if (currentLevel < 0 || currentLevel >= MAX_HINT_LEVEL) return null;

    const rung = policy.rungs[currentLevel];
    if (!rung || !rung.auto) return null;

    return rung.delaySeconds;
}

/**
 * The hint level a word is *entitled* to by the time the player faces it.
 *
 * The chain is presented newest-last: the final word is the freebie the player
 * is given, and the one before it is the first they actually play. Under
 * `first-word` only that word carries a pre-applied level — which is what the
 * `dailygame-auto-hint-level` experiment has always done. Both `every-word`
 * reaches extend it to the whole chain.
 *
 * This is the level scoring reads when deciding which tiers were free, so it
 * deliberately ignores *when* the level is applied — a word the player has not
 * reached yet is still entitled to it.
 *
 * The freebie itself never carries a level; it is already solved.
 */
export function startLevelFor(policy: DailyHintPolicy, index: number, total: number): number {
    const level = clampLevel(policy.startLevel);
    if (level === 0 || total < 2) return 0;

    const givenIndex = total - 1;
    if (index === givenIndex || index < 0) return 0;

    if (policy.startLevelAppliesTo === 'first-word') return index === total - 2 ? level : 0;

    return level;
}

/**
 * The hint level a word *displays* on a freshly built board.
 *
 * The same as `startLevelFor` except under `every-word-on-arrival`, where only
 * the first word played opens hinted and the rest are raised as the player
 * reaches them (see `applyArrivalHint`). That is the difference the game master
 * is choosing between: whether the whole board is scrambled from the outset or
 * only the word in front of them.
 */
export function openingHintLevel(policy: DailyHintPolicy, index: number, total: number): number {
    const level = startLevelFor(policy, index, total);
    if (level === 0) return 0;

    if (policy.startLevelAppliesTo === 'every-word-on-arrival') {
        return index === total - 2 ? level : 0;
    }

    return level;
}

/** Game-master settings as stored, with the scope that decides who they bind. */
export type GameMasterHintSettings = {
    policy: DailyHintPolicy;
    /**
     * `default` seeds only players who have stored no preference of their own;
     * `force` overrides everyone. Balancing wants `force` — otherwise your own
     * account, which has preferences saved from the first time you opened the
     * info screen, will not move and the panel will look broken.
     */
    scope: 'default' | 'force';
    /**
     * Revision of the `game_settings` row these came from. Zero or absent means
     * nobody has saved a policy and the game is running on the compiled
     * defaults — the only state in which an experiment may still set the start
     * level. See `resolveHintPolicy`.
     */
    revision?: number;
};

/**
 * Whether a game master has actually saved a policy, as opposed to the game
 * running on the compiled defaults. Exported so the daily game can log a
 * discarded experiment assignment without re-deriving the question.
 */
export function isGameMasterConfigured(gm: GameMasterHintSettings): boolean {
    return typeof gm.revision === 'number' && gm.revision > 0;
}

/** What a player may set for themselves, from `profiles.settings` or localStorage. */
export type PlayerHintPreferences = {
    autoEnabled?: boolean;
    /** The legacy single delay. Applied to every rung. */
    duration?: number;
};

/**
 * Folds the three sources into the policy the game actually runs.
 *
 * Precedence is player, then game master, then experiment, then the compiled
 * defaults — but the player only reaches the two preferences they can express,
 * and only when the game master has left scope at `default`. Experiments touch
 * `startLevel` alone; the rest of the policy is not an A/B surface.
 *
 * The experiment sits *below* the game master rather than above it. It used to
 * win, so a `dailygame-auto-hint-level` assignment left over from before the
 * admin panel existed silently overrode the saved start level: the panel
 * promised a scramble on every word and players got the first letter. A stored
 * policy is someone's deliberate act, so it wins; the experiment still assigns
 * a level to anyone playing on the compiled defaults.
 */
export function resolveHintPolicy(
    gm: GameMasterHintSettings,
    player: PlayerHintPreferences = {},
    experimentStartLevel?: number | null,
): DailyHintPolicy {
    const policy: DailyHintPolicy = {
        ...gm.policy,
        rungs: gm.policy.rungs.map((r) => ({ ...r })) as DailyHintPolicy['rungs'],
    };

    if (
        experimentStartLevel !== undefined
        && experimentStartLevel !== null
        && !isGameMasterConfigured(gm)
    ) {
        policy.startLevel = clampLevel(experimentStartLevel);
    }

    if (gm.scope === 'force') return policy;

    if (typeof player.autoEnabled === 'boolean') {
        policy.autoEnabled = player.autoEnabled;
    }

    if (typeof player.duration === 'number' && Number.isFinite(player.duration)) {
        const delaySeconds = clampDelay(player.duration);
        policy.rungs = policy.rungs.map((r) => ({ ...r, delaySeconds })) as DailyHintPolicy['rungs'];
    }

    return policy;
}

function clampLevel(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(MAX_HINT_LEVEL, Math.round(value)));
}

function clampDelay(value: number): number {
    if (!Number.isFinite(value)) return DEFAULT_HINT_POLICY.rungs[0].delaySeconds;
    return Math.max(0, Math.min(MAX_RUNG_DELAY_SECONDS, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRung(raw: unknown, fallback: HintRung): HintRung {
    if (!isRecord(raw)) return { ...fallback };

    return {
        auto: typeof raw.auto === 'boolean' ? raw.auto : fallback.auto,
        delaySeconds: typeof raw.delaySeconds === 'number'
            ? clampDelay(raw.delaySeconds)
            : fallback.delaySeconds,
    };
}

function parseEnum<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
    return typeof raw === 'string' && (allowed as readonly string[]).includes(raw)
        ? (raw as T)
        : fallback;
}

/**
 * Turns whatever is in the `game_settings` jsonb column into a usable policy.
 *
 * Total by construction: it never throws and never returns a partial object.
 * This is the boundary between a hand-editable database column and the game
 * loop, so a malformed value has to degrade to the default rather than take the
 * daily game down with it.
 */
export function parseHintPolicy(raw: unknown): DailyHintPolicy {
    if (!isRecord(raw)) return { ...DEFAULT_HINT_POLICY, rungs: cloneRungs(DEFAULT_HINT_POLICY) };

    const rawRungs = Array.isArray(raw.rungs) ? raw.rungs : [];

    return {
        startLevel: typeof raw.startLevel === 'number'
            ? clampLevel(raw.startLevel)
            : DEFAULT_HINT_POLICY.startLevel,
        startLevelAppliesTo: parseEnum(
            raw.startLevelAppliesTo,
            START_LEVEL_REACHES,
            DEFAULT_HINT_POLICY.startLevelAppliesTo,
        ),
        chargeForStartLevel: typeof raw.chargeForStartLevel === 'boolean'
            ? raw.chargeForStartLevel
            : DEFAULT_HINT_POLICY.chargeForStartLevel,
        autoEnabled: typeof raw.autoEnabled === 'boolean'
            ? raw.autoEnabled
            : DEFAULT_HINT_POLICY.autoEnabled,
        rungs: [
            parseRung(rawRungs[0], DEFAULT_HINT_POLICY.rungs[0]),
            parseRung(rawRungs[1], DEFAULT_HINT_POLICY.rungs[1]),
            parseRung(rawRungs[2], DEFAULT_HINT_POLICY.rungs[2]),
        ],
        progression: parseEnum(
            raw.progression,
            ['ladder', 'jump'] as const,
            DEFAULT_HINT_POLICY.progression,
        ),
        stagger: parseEnum(
            raw.stagger,
            ['per-rung', 'cumulative'] as const,
            DEFAULT_HINT_POLICY.stagger,
        ),
        onRevisionChange: parseEnum(
            raw.onRevisionChange,
            ['keep', 'restart'] as const,
            DEFAULT_HINT_POLICY.onRevisionChange,
        ),
    };
}

function cloneRungs(policy: DailyHintPolicy): DailyHintPolicy['rungs'] {
    return policy.rungs.map((r) => ({ ...r })) as DailyHintPolicy['rungs'];
}
