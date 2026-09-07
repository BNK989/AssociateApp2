import { createLogger, getErrorMessage } from '@/lib/logger';
import { frequencyOf, type ToneSpec } from './rewardNotes';

const log = createLogger('audio/reward');

/**
 * A tiny Web Audio voice for the reward chimes.
 *
 * One `AudioContext` per page, created lazily and only on a user gesture: every
 * browser starts it suspended otherwise, and constructing one on mount just
 * leaves a suspended context lying around until the first click anyway.
 *
 * Everything here is I/O. The musical decisions live in `rewardNotes.ts`.
 */

/** Cents of random detune per tone, so repeated solves never sound identical. */
const DETUNE_JITTER_CENTS = 7;

/** Envelope attack. Long enough to avoid a click, short enough to feel instant. */
const ATTACK_SECONDS = 0.008;

/** Floor for the exponential release ramp; `exponentialRampToValueAtTime` rejects 0. */
const SILENCE = 0.0001;

type AudioContextCtor = new () => AudioContext;

/** `webkitAudioContext` is still what older iOS Safari exposes. */
function audioContextCtor(): AudioContextCtor | null {
    if (typeof window === 'undefined') return null;

    const scoped = window as Window & {
        AudioContext?: AudioContextCtor;
        webkitAudioContext?: AudioContextCtor;
    };

    return scoped.AudioContext ?? scoped.webkitAudioContext ?? null;
}

export type RewardSynth = {
    /** Plays a voicing at `volume` (0–1). A no-op when the context is unusable. */
    play(tones: readonly ToneSpec[], volume: number): void;
    /** Resumes a context the browser suspended. Safe to call on every gesture. */
    unlock(): void;
    /** Releases the context. Called when the component that owns it unmounts. */
    close(): void;
    /** True once a context exists, which is what tests and diagnostics assert on. */
    readonly ready: boolean;
};

/**
 * Creates a synth, or returns null where Web Audio is unavailable.
 *
 * A null return is not an error and is not logged as one: it is what happens
 * during SSR and in a test environment, and every caller treats reward audio as
 * optional. A player on a browser without Web Audio loses the chime and nothing
 * else.
 */
export function createRewardSynth(): RewardSynth | null {
    const found = audioContextCtor();
    if (!found) return null;

    // Bound to a const the closures capture, so TypeScript keeps the narrowing.
    const Ctor: AudioContextCtor = found;
    let context: AudioContext | null = null;

    /** Built on first use so the context is created inside a gesture handler. */
    function ensureContext(): AudioContext | null {
        if (context) return context;

        try {
            context = new Ctor();
            return context;
        } catch (e) {
            log.warn('create_context', 'Could not create an AudioContext; reward audio is off', undefined, e);
            return null;
        }
    }

    function playTone(ctx: AudioContext, tone: ToneSpec, volume: number): void {
        const startAt = ctx.currentTime + tone.startAt;
        const endAt = startAt + tone.duration;

        const oscillator = ctx.createOscillator();
        oscillator.type = tone.wave;
        oscillator.frequency.setValueAtTime(frequencyOf(tone.semitones), startAt);
        oscillator.detune.setValueAtTime((Math.random() * 2 - 1) * DETUNE_JITTER_CENTS, startAt);

        if (tone.glideTo !== undefined) {
            oscillator.frequency.exponentialRampToValueAtTime(frequencyOf(tone.glideTo), endAt);
        }

        // Percussive: snap up, then decay for the rest of the tone. A plucked
        // shape reads as an event; a sustained one reads as a notification.
        const envelope = ctx.createGain();
        const peak = Math.max(SILENCE, tone.gain * volume);
        envelope.gain.setValueAtTime(SILENCE, startAt);
        envelope.gain.exponentialRampToValueAtTime(peak, startAt + ATTACK_SECONDS);
        envelope.gain.exponentialRampToValueAtTime(SILENCE, endAt);

        oscillator.connect(envelope);
        envelope.connect(ctx.destination);

        oscillator.start(startAt);
        oscillator.stop(endAt);

        // Nodes are single-use; dropping the references lets them be collected
        // rather than accumulating one graph per solve for the whole session.
        oscillator.onended = () => {
            oscillator.disconnect();
            envelope.disconnect();
        };
    }

    return {
        get ready() {
            return context !== null;
        },

        unlock() {
            const ctx = ensureContext();
            if (!ctx || ctx.state !== 'suspended') return;

            ctx.resume().catch((e) => {
                log.debug('unlock', 'AudioContext resume was refused', {
                    state: ctx.state,
                    reason: getErrorMessage(e),
                });
            });
        },

        play(tones, volume) {
            if (volume <= 0 || tones.length === 0) return;

            const ctx = ensureContext();
            if (!ctx) return;

            // A context suspended by a tab switch stays suspended until asked.
            // Without this the first solve after returning to the tab is silent.
            if (ctx.state === 'suspended') {
                ctx.resume().catch((e) => {
                    log.debug('play', 'AudioContext resume was refused before playback', {
                        reason: getErrorMessage(e),
                    });
                });
            }

            try {
                for (const tone of tones) playTone(ctx, tone, volume);
            } catch (e) {
                log.warn('play', 'Reward chime failed to play', { tones: tones.length, volume }, e);
            }
        },

        close() {
            if (!context) return;

            const closing = context;
            context = null;
            closing.close().catch((e) => {
                log.debug('close', 'AudioContext close was refused', { reason: getErrorMessage(e) });
            });
        },
    };
}
