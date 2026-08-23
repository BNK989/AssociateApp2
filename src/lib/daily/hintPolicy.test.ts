import { describe, expect, it } from 'vitest';
import { GAME_CONFIG, MAX_HINT_LEVEL } from '@/lib/gameConfig';
import {
    autoRevealDelay,
    clockOrigin,
    DEFAULT_HINT_POLICY,
    MAX_RUNG_DELAY_SECONDS,
    openingHintLevel,
    parseHintPolicy,
    resolveHintPolicy,
    START_LEVEL_REACHES,
    startLevelFor,
    type DailyHintPolicy,
    type GameMasterHintSettings,
} from './hintPolicy';

function policy(overrides: Partial<DailyHintPolicy> = {}): DailyHintPolicy {
    return {
        ...DEFAULT_HINT_POLICY,
        rungs: DEFAULT_HINT_POLICY.rungs.map((r) => ({ ...r })) as DailyHintPolicy['rungs'],
        ...overrides,
    };
}

function gm(overrides: Partial<DailyHintPolicy> = {}, scope: 'default' | 'force' = 'default'): GameMasterHintSettings {
    return { policy: policy(overrides), scope };
}

describe('DEFAULT_HINT_POLICY', () => {
    // The whole migration rests on this: the policy model has to be able to
    // express the behaviour that existed before it, or rolling it out is a
    // silent gameplay change rather than a refactor.
    it('reproduces the pre-policy behaviour', () => {
        expect(DEFAULT_HINT_POLICY.startLevel).toBe(0);
        expect(DEFAULT_HINT_POLICY.startLevelAppliesTo).toBe('first-word');
        expect(DEFAULT_HINT_POLICY.chargeForStartLevel).toBe(true);
        expect(DEFAULT_HINT_POLICY.stagger).toBe('per-rung');
        expect(DEFAULT_HINT_POLICY.onRevisionChange).toBe('keep');
        expect(DEFAULT_HINT_POLICY.autoEnabled).toBe(GAME_CONFIG.DEFAULT_AUTO_HINT_ENABLED);
    });

    it('gives every rung the single delay the old scalar model used', () => {
        for (const rung of DEFAULT_HINT_POLICY.rungs) {
            expect(rung.auto).toBe(true);
            expect(rung.delaySeconds).toBe(GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION);
        }
    });

    it('maps the legacy reveal-type constant onto progression', () => {
        const expected = GAME_CONFIG.DEFAULT_AUTO_HINT_REVEAL_TYPE === 'ALL' ? 'jump' : 'ladder';
        expect(DEFAULT_HINT_POLICY.progression).toBe(expected);
    });
});

describe('autoRevealDelay', () => {
    it('reads the rung matching the level being climbed from', () => {
        const p = policy({
            rungs: [
                { auto: true, delaySeconds: 15 },
                { auto: true, delaySeconds: 30 },
                { auto: true, delaySeconds: 60 },
            ],
        });

        expect(autoRevealDelay(p, 0)).toBe(15);
        expect(autoRevealDelay(p, 1)).toBe(30);
        expect(autoRevealDelay(p, 2)).toBe(60);
    });

    it('returns null once the ladder is finished', () => {
        expect(autoRevealDelay(policy(), MAX_HINT_LEVEL)).toBeNull();
        expect(autoRevealDelay(policy(), MAX_HINT_LEVEL + 1)).toBeNull();
    });

    it('returns null for a negative level rather than reading off the end', () => {
        expect(autoRevealDelay(policy(), -1)).toBeNull();
    });

    it('returns null when the master switch is off', () => {
        expect(autoRevealDelay(policy({ autoEnabled: false }), 0)).toBeNull();
    });

    // The point of per-rung `auto`: a game master can automate the cheap hints
    // and still make players ask for the clue that gives the answer away.
    it('returns null for a rung marked manual-only, without stopping the others', () => {
        const p = policy({
            rungs: [
                { auto: true, delaySeconds: 10 },
                { auto: true, delaySeconds: 20 },
                { auto: false, delaySeconds: 30 },
            ],
        });

        expect(autoRevealDelay(p, 0)).toBe(10);
        expect(autoRevealDelay(p, 1)).toBe(20);
        expect(autoRevealDelay(p, 2)).toBeNull();
    });

    it('treats a zero delay as a real value, not as absent', () => {
        const p = policy({
            rungs: [
                { auto: true, delaySeconds: 0 },
                { auto: true, delaySeconds: 0 },
                { auto: true, delaySeconds: 0 },
            ],
        });

        expect(autoRevealDelay(p, 0)).toBe(0);
    });
});

describe('clockOrigin', () => {
    it('restarts the clock after each reveal when staggering per rung', () => {
        expect(clockOrigin(policy({ stagger: 'per-rung' }))).toBe('rung-armed');
    });

    it('measures from the word opening when cumulative', () => {
        expect(clockOrigin(policy({ stagger: 'cumulative' }))).toBe('word-opened');
    });
});

describe('resolveHintPolicy', () => {
    it('uses the game master policy when the player has expressed nothing', () => {
        const resolved = resolveHintPolicy(gm({ autoEnabled: false }), {});
        expect(resolved.autoEnabled).toBe(false);
    });

    it('lets a player override under default scope', () => {
        const resolved = resolveHintPolicy(gm({ autoEnabled: true }), { autoEnabled: false });
        expect(resolved.autoEnabled).toBe(false);
    });

    // Without this, changing a value in the admin panel appears to do nothing
    // for anyone who has ever opened the info screen -- which includes the
    // game master doing the balancing.
    it('ignores the player entirely under force scope', () => {
        const settings = gm({ autoEnabled: true }, 'force');
        const resolved = resolveHintPolicy(settings, { autoEnabled: false, duration: 99 });

        expect(resolved.autoEnabled).toBe(true);
        expect(resolved.rungs.map((r) => r.delaySeconds))
            .toEqual(DEFAULT_HINT_POLICY.rungs.map((r) => r.delaySeconds));
    });

    it('spreads the legacy single duration across every rung', () => {
        const resolved = resolveHintPolicy(gm(), { duration: 45 });
        expect(resolved.rungs.map((r) => r.delaySeconds)).toEqual([45, 45, 45]);
    });

    it('keeps per-rung auto flags when the player only changes the duration', () => {
        const settings = gm({
            rungs: [
                { auto: true, delaySeconds: 10 },
                { auto: false, delaySeconds: 20 },
                { auto: false, delaySeconds: 30 },
            ],
        });
        const resolved = resolveHintPolicy(settings, { duration: 5 });

        expect(resolved.rungs.map((r) => r.auto)).toEqual([true, false, false]);
        expect(resolved.rungs.map((r) => r.delaySeconds)).toEqual([5, 5, 5]);
    });

    it('clamps a player duration that is out of range', () => {
        expect(resolveHintPolicy(gm(), { duration: -10 }).rungs[0].delaySeconds).toBe(0);
        expect(resolveHintPolicy(gm(), { duration: 10_000 }).rungs[0].delaySeconds)
            .toBe(MAX_RUNG_DELAY_SECONDS);
    });

    it('applies an experiment to the start level only', () => {
        const resolved = resolveHintPolicy(gm({ startLevel: 0, autoEnabled: true }), {}, 2);

        expect(resolved.startLevel).toBe(2);
        expect(resolved.autoEnabled).toBe(true);
    });

    it('leaves the start level alone when no experiment is assigned', () => {
        expect(resolveHintPolicy(gm({ startLevel: 1 }), {}, null).startLevel).toBe(1);
        expect(resolveHintPolicy(gm({ startLevel: 1 }), {}, undefined).startLevel).toBe(1);
    });

    it('honours an experiment even under force scope, since players do not set it', () => {
        const resolved = resolveHintPolicy(gm({ startLevel: 0 }, 'force'), {}, 3);
        expect(resolved.startLevel).toBe(3);
    });

    it('does not mutate the stored policy it was handed', () => {
        const settings = gm({ autoEnabled: true });
        resolveHintPolicy(settings, { autoEnabled: false, duration: 1 });

        expect(settings.policy.autoEnabled).toBe(true);
        expect(settings.policy.rungs[0].delaySeconds)
            .toBe(GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION);
    });
});

describe('parseHintPolicy', () => {
    it('falls back to the default for anything that is not an object', () => {
        for (const raw of [null, undefined, 42, 'policy', [], true]) {
            expect(parseHintPolicy(raw)).toEqual(DEFAULT_HINT_POLICY);
        }
    });

    it('reads a fully specified policy', () => {
        const raw = {
            startLevel: 1,
            startLevelAppliesTo: 'every-word',
            chargeForStartLevel: false,
            autoEnabled: true,
            rungs: [
                { auto: true, delaySeconds: 15 },
                { auto: true, delaySeconds: 30 },
                { auto: false, delaySeconds: 60 },
            ],
            progression: 'jump',
            stagger: 'cumulative',
            onRevisionChange: 'restart',
        };

        expect(parseHintPolicy(raw)).toEqual(raw);
    });

    it('fills in each missing field independently', () => {
        const parsed = parseHintPolicy({ startLevel: 2 });

        expect(parsed.startLevel).toBe(2);
        expect(parsed.stagger).toBe(DEFAULT_HINT_POLICY.stagger);
        expect(parsed.rungs).toEqual(DEFAULT_HINT_POLICY.rungs);
    });

    it('rejects an unknown enum value rather than passing it through', () => {
        const parsed = parseHintPolicy({
            stagger: 'sideways',
            progression: 'sprint',
            startLevelAppliesTo: 'some-words',
        });

        expect(parsed.stagger).toBe(DEFAULT_HINT_POLICY.stagger);
        expect(parsed.progression).toBe(DEFAULT_HINT_POLICY.progression);
        expect(parsed.startLevelAppliesTo).toBe(DEFAULT_HINT_POLICY.startLevelAppliesTo);
    });

    it('round-trips every reach the panel can store', () => {
        for (const appliesTo of START_LEVEL_REACHES) {
            expect(parseHintPolicy({ startLevelAppliesTo: appliesTo }).startLevelAppliesTo)
                .toBe(appliesTo);
        }
    });

    it('clamps out-of-range numbers instead of rejecting the whole policy', () => {
        const parsed = parseHintPolicy({
            startLevel: 99,
            rungs: [{ auto: true, delaySeconds: -5 }, { auto: true, delaySeconds: 99_999 }, {}],
        });

        expect(parsed.startLevel).toBe(MAX_HINT_LEVEL);
        expect(parsed.rungs[0].delaySeconds).toBe(0);
        expect(parsed.rungs[1].delaySeconds).toBe(MAX_RUNG_DELAY_SECONDS);
        expect(parsed.rungs[2]).toEqual(DEFAULT_HINT_POLICY.rungs[2]);
    });

    it('pads a short or malformed rung list to three', () => {
        expect(parseHintPolicy({ rungs: [] }).rungs).toEqual(DEFAULT_HINT_POLICY.rungs);
        expect(parseHintPolicy({ rungs: 'nope' }).rungs).toEqual(DEFAULT_HINT_POLICY.rungs);
        expect(parseHintPolicy({ rungs: [{ auto: false }] }).rungs[0]).toEqual({
            auto: false,
            delaySeconds: DEFAULT_HINT_POLICY.rungs[0].delaySeconds,
        });
    });

    it('ignores wrongly typed scalars', () => {
        const parsed = parseHintPolicy({ autoEnabled: 'yes', chargeForStartLevel: 1, startLevel: '2' });

        expect(parsed.autoEnabled).toBe(DEFAULT_HINT_POLICY.autoEnabled);
        expect(parsed.chargeForStartLevel).toBe(DEFAULT_HINT_POLICY.chargeForStartLevel);
        expect(parsed.startLevel).toBe(DEFAULT_HINT_POLICY.startLevel);
    });

    it('returns a policy that is safe to mutate', () => {
        const parsed = parseHintPolicy(null);
        parsed.rungs[0].delaySeconds = 1;

        expect(DEFAULT_HINT_POLICY.rungs[0].delaySeconds)
            .toBe(GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION);
    });
});
