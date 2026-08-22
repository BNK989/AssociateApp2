import { DEFAULT_HINT_POLICY, type DailyHintPolicy } from '@/lib/daily/hintPolicy';
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
 * Absent auto-hint preferences fall back to the game master's policy rather
 * than to the compiled constants, so the screen shows what is actually in
 * effect. The delay is represented by the first rung: the screen has one slider
 * and the policy has three, and the time to the *first* hint is the number a
 * player is really asking about.
 *
 * Note the two different fallback rules, which are not interchangeable:
 * `auto_hint_*` fall back to the policy when absent, whereas audio is treated
 * as on unless explicitly stored as `false`. Rows written before the audio
 * toggle existed must default to sound on, so `?? true` and `!== false` behave
 * the same for `undefined` but differ for any other falsy value.
 */
export function resolveInfoSettings(
    settings: ProfileSettings | null | undefined,
    policy: DailyHintPolicy = DEFAULT_HINT_POLICY,
): ResolvedInfoSettings {
    const source = settings ?? {};

    return {
        autoHintEnabled: source.auto_hint_enabled ?? policy.autoEnabled,
        duration: source.auto_hint_duration ?? policy.rungs[0].delaySeconds,
        audioEnabled: source.enable_audio_chime !== false,
    };
}
