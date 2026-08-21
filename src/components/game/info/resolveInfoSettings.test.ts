import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { resolveInfoSettings } from './resolveInfoSettings';

describe('resolveInfoSettings', () => {
    it('falls back to the configured defaults for an empty blob', () => {
        expect(resolveInfoSettings({})).toEqual({
            autoHintEnabled: GAME_CONFIG.DEFAULT_AUTO_HINT_ENABLED,
            duration: GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION,
            audioEnabled: true,
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
        })).toEqual({ autoHintEnabled: false, duration: 3, audioEnabled: false });
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
});
