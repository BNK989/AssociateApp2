import { useCallback, useEffect, useRef } from 'react';
import { createRewardSynth, type RewardSynth } from '@/lib/audio/rewardSynth';
import { missVoicing, solveVoicing } from '@/lib/audio/rewardNotes';
import type { DailyFeedbackPolicy } from '@/lib/daily/feedbackPolicy';
import type { SolveFeedback, SolveTier } from '@/lib/daily/feedbackTiers';

/**
 * Vibration, in milliseconds, per tier. Short: a phone buzzing for a fifth of a
 * second on every correct answer stops being a reward within a minute.
 */
const HAPTIC_MS: Record<SolveTier, number> = {
    assisted: 10,
    solid: 18,
    clean: 28,
};

/** Two quick taps for a miss, which no solve pattern uses. */
const MISS_HAPTIC: readonly number[] = [12, 40, 12];

/** Gestures that count as permission to start audio. */
const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;

function vibrate(pattern: number | readonly number[]): void {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    // Refused in an unengaged tab, and it reports that by returning false
    // rather than throwing. Nothing here depends on it having worked.
    navigator.vibrate(pattern as VibratePattern);
}

/**
 * The sound and haptics half of a move's feedback.
 *
 * Owns one lazily created `AudioContext` for the page and arms it on the first
 * user gesture, because every browser starts one suspended. The visual half is
 * `SolveBurst`; the two are driven from the same `SolveFeedback` so they can
 * never disagree about how good a solve was.
 *
 * The policy is read through a ref, so changing the volume mid-game does not
 * hand every consumer new callbacks and re-run the effects that depend on them.
 */
export function useRewardFeedback(policy: DailyFeedbackPolicy) {
    const synthRef = useRef<RewardSynth | null>(null);
    const policyRef = useRef(policy);

    // Synced in an effect rather than assigned during render: writing a ref
    // while rendering is what `react-hooks/refs` forbids, and the only readers
    // are event handlers that cannot run before this has committed.
    useEffect(() => {
        policyRef.current = policy;
    }, [policy]);

    useEffect(() => {
        const synth = createRewardSynth();
        synthRef.current = synth;

        if (!synth) return;

        // Created inside the handler, so the context is born in a gesture and
        // is never blocked by the autoplay policy.
        const unlock = () => synth.unlock();
        for (const event of UNLOCK_EVENTS) {
            window.addEventListener(event, unlock, { passive: true });
        }

        return () => {
            for (const event of UNLOCK_EVENTS) window.removeEventListener(event, unlock);
            synth.close();
            synthRef.current = null;
        };
    }, []);

    /** Plays a tier at a given streak rung, ignoring whether it was earned. */
    const preview = useCallback((tier: SolveTier, streakStep = 0) => {
        const active = policyRef.current;
        if (!active.soundEnabled) return;

        synthRef.current?.play(solveVoicing(tier, streakStep, active.streakPitch), active.volume);
    }, []);

    const playSolve = useCallback((feedback: SolveFeedback) => {
        const active = policyRef.current;

        if (active.soundEnabled) {
            synthRef.current?.play(
                solveVoicing(feedback.tier, feedback.streakStep, active.streakPitch),
                active.volume,
            );
        }

        if (active.haptics) vibrate(HAPTIC_MS[feedback.tier]);
    }, []);

    const playMiss = useCallback(() => {
        const active = policyRef.current;

        if (active.soundEnabled && active.missSound) {
            synthRef.current?.play(missVoicing(), active.volume);
        }

        if (active.haptics) vibrate(MISS_HAPTIC);
    }, []);

    return { playSolve, playMiss, preview };
}
