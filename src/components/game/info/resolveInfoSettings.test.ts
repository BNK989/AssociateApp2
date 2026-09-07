import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { DEFAULT_HINT_POLICY } from '@/lib/daily/hintPolicy';
import { resolveInfoSettings } from './resolveInfoSettings';

describe('resolveInfoSettings', () => {
    it('falls back to the configured defaults for an empty blob', () => {
        expect(resolveInfoSettings({})).toEqual({
            autoHintEnabled: GAME_CONFIG.DEFAULT_AUTO_HINT_ENABLED,
            duration: GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION,
            audioEnabled: true,
            volume: 1,
        });
    });

    it('treats null and undefined the same as an empty blob', () => {
        expect(resolveInfoSettings(null)).toEqual(resolveInfoSettings({}));
        expect(resolveInfoSettings(undefined)).toEqual(resolveInfoSettings({}));
    });

    it('uses stored values when present', () => {
        expect(resolveInfoSettings({
            auto_hint_enabled: false,
            auto_hint_duration: 3,
            enable_audio_chime: false,
        })).toEqual({ autoHintEnabled: false, duration: 3, audioEnabled: false, volume: 1 });
    });

    it('keeps an explicit zero delay rather than falling back', () => {
        // 0 means "reveal immediately" and must survive the ?? fallback.
        expect(resolveInfoSettings({ auto_hint_duration: 0 }).duration).toBe(0);
    });

    it('keeps an explicit false for auto-hint rather than falling back', () => {
        expect(resolveInfoSettings({ auto_hint_enabled: false }).autoHintEnabled).toBe(false);
    });

    it('defaults audio on for rows written before the toggle existed', () => {
        expect(resolveInfoSettings({ auto_hint_enabled: true }).audioEnabled).toBe(true);
    });

    it('turns audio off only when stored as exactly false', () => {
        expect(resolveInfoSettings({ enable_audio_chime: false }).audioEnabled).toBe(false);
        expect(resolveInfoSettings({ enable_audio_chime: true }).audioEnabled).toBe(true);
    });

    // Volume follows the audio rule, not the auto-hint one: a player who has
    // never touched it has not asked to be quieter.
    it('defaults volume to full when nothing is stored', () => {
        expect(resolveInfoSettings({}).volume).toBe(1);
    });

    it('keeps a stored volume, including an explicit zero', () => {
        expect(resolveInfoSettings({ audio_volume: 0.4 }).volume).toBe(0.4);
        expect(resolveInfoSettings({ audio_volume: 0 }).volume).toBe(0);
    });

    // A stored 5 would multiply the game master's ceiling instead of scaling
    // it, which is how a settings blob becomes a bug report about the volume.
    it('clamps a volume outside 0-1 rather than passing it on', () => {
        expect(resolveInfoSettings({ audio_volume: 5 }).volume).toBe(1);
        expect(resolveInfoSettings({ audio_volume: -2 }).volume).toBe(0);
        expect(resolveInfoSettings({ audio_volume: Number.NaN }).volume).toBe(1);
    });

    describe('with a game-master policy', () => {
        const policy = {
            ...DEFAULT_HINT_POLICY,
            autoEnabled: false,
            rungs: [
                { auto: true, delaySeconds: 45 },
                { auto: true, delaySeconds: 90 },
                { auto: false, delaySeconds: 120 },
            ] as typeof DEFAULT_HINT_POLICY.rungs,
        };

        // Otherwise the screen advertises the compiled constant while the game
        // is actually running on whatever the game master set.
        it('falls back to the policy rather than the compiled constants', () => {
            expect(resolveInfoSettings({}, policy)).toEqual({
                autoHintEnabled: false,
                duration: 45,
                audioEnabled: true,
                volume: 1,
            });
        });

        // One slider, three rungs: the time to the first hint is the number the
        // player is actually asking about.
        it('represents the delay with the first rung', () => {
            expect(resolveInfoSettings({}, policy).duration).toBe(45);
        });

        it('still prefers what the player stored', () => {
            expect(resolveInfoSettings({ auto_hint_enabled: true, auto_hint_duration: 5 }, policy))
                .toEqual({ autoHintEnabled: true, duration: 5, audioEnabled: true, volume: 1 });
        });

        it('keeps an explicit zero delay against a non-zero policy', () => {
            expect(resolveInfoSettings({ auto_hint_duration: 0 }, policy).duration).toBe(0);
        });
    });
});
