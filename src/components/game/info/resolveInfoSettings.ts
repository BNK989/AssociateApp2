import { GAME_CONFIG } from '@/lib/gameConfig';
import type { ProfileSettings } from '@/types/app';

export type ResolvedInfoSettings = {
    autoHintEnabled: boolean;
    duration: number;
    audioEnabled: boolean;
};

/**
 * Turns a stored (and possibly ancient, possibly empty) settings blob into the
 * concrete values the info screen renders.
 *
 * Note the two different fallback rules, which are not interchangeable:
 * `auto_hint_*` fall back to the configured defaults when absent, whereas audio
 * is treated as on unless explicitly stored as `false`. Rows written before the
 * audio toggle existed must default to sound on, so `?? true` and `!== false`
 * behave the same for `undefined` but differ for any other falsy value.
 */
export function resolveInfoSettings(settings: ProfileSettings | null | undefined): ResolvedInfoSettings {
    const source = settings ?? {};

    return {
        autoHintEnabled: source.auto_hint_enabled ?? GAME_CONFIG.DEFAULT_AUTO_HINT_ENABLED,
        duration: source.auto_hint_duration ?? GAME_CONFIG.DEFAULT_AUTO_HINT_DURATION,
        audioEnabled: source.enable_audio_chime !== false,
    };
}
