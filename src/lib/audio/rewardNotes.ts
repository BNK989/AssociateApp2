import { MAX_STREAK_STEP, type SolveTier } from '@/lib/daily/feedbackTiers';

/**
 * The note material the reward chimes are built from.
 *
 * Kept apart from the synth so the musical decisions can be tested without a
 * Web Audio context: this module answers *what* to play, `rewardSynth.ts`
 * answers *how* to make a sound.
 *
 * Everything is synthesised rather than sampled. Three reasons, in order of
 * how much they mattered: a streak that transposes upward is impossible with a
 * fixed mp3; every parameter here is reachable from the admin panel, so reward
 * feel can be tuned without a deploy; and it costs no bandwidth at all against
 * the ~10KB the single chime it replaces was downloading.
 */

/** C5. High enough to cut through, low enough not to be shrill on a phone. */
export const ROOT_HZ = 523.25;

/** One tone in a voicing. Times are seconds relative to the trigger. */
export type ToneSpec = {
    /** Semitones from `ROOT_HZ`. */
    semitones: number;
    /** Delay before this tone starts. */
    startAt: number;
    /** How long it rings, envelope included. */
    duration: number;
    /** Peak gain, 0–1, before the master volume is applied. */
    gain: number;
    wave: OscillatorType;
    /**
     * Semitones the tone glides to over its duration. Absent means no glide.
     * Only the miss tone uses this — a falling pitch is the most legible "no"
     * there is, and it keeps the sound from being mistaken for a reward.
     */
    glideTo?: number;
};

/**
 * The rungs a streak climbs, in semitones from the root.
 *
 * A major pentatonic, so any two rungs sound consonant together and the ladder
 * never lands on a note that reads as a mistake. Indexed by streak step, and
 * `MAX_STREAK_STEP` is exactly its last index.
 */
export const STREAK_LADDER = [0, 2, 4, 7, 9, 12] as const;

/** Semitone offset a streak of `streakStep` rungs transposes the chime by. */
export function streakTranspose(streakStep: number): number {
    if (!Number.isFinite(streakStep) || streakStep <= 0) return 0;
    const rung = Math.min(Math.floor(streakStep), MAX_STREAK_STEP);
    return STREAK_LADDER[rung];
}

/** Frequency in Hz of a note `semitones` from the root, in equal temperament. */
export function frequencyOf(semitones: number): number {
    return ROOT_HZ * 2 ** (semitones / 12);
}

/**
 * The three solve voicings, in ascending order of reward.
 *
 * The shape is the message and the pitch is only the accent: one note means
 * "counted", two mean "good", four mean "you did that yourself". A player
 * learns the difference in a handful of solves without being told, which is the
 * whole point of tiering the sound rather than getting louder.
 */
const VOICINGS: Record<SolveTier, readonly ToneSpec[]> = {
    // Soft, single, quickly gone. This fires when the AI clue did the work, so
    // it acknowledges the move without congratulating anyone for it.
    assisted: [
        { semitones: 0, startAt: 0, duration: 0.18, gain: 0.35, wave: 'sine' },
    ],
    // Root and fifth. An open interval, satisfying and unfussy — this is the
    // sound the player hears most, so it has to survive a few hundred repeats.
    solid: [
        { semitones: 0, startAt: 0, duration: 0.22, gain: 0.5, wave: 'triangle' },
        { semitones: 7, startAt: 0.07, duration: 0.26, gain: 0.42, wave: 'triangle' },
    ],
    // A full major arpeggio to the octave, the last note held. Reserved for a
    // solve that took no hints, so it stays rare enough to still land.
    clean: [
        { semitones: 0, startAt: 0, duration: 0.2, gain: 0.5, wave: 'triangle' },
        { semitones: 4, startAt: 0.065, duration: 0.2, gain: 0.46, wave: 'triangle' },
        { semitones: 7, startAt: 0.13, duration: 0.24, gain: 0.44, wave: 'triangle' },
        { semitones: 12, startAt: 0.195, duration: 0.42, gain: 0.4, wave: 'triangle' },
    ],
};

/**
 * The chime for one solve.
 *
 * `streakPitch` is the game master's switch: with it off the tiers still
 * differ from each other, they just stop climbing as a streak runs.
 */
export function solveVoicing(
    tier: SolveTier,
    streakStep: number,
    streakPitch: boolean,
): ToneSpec[] {
    const shift = streakPitch ? streakTranspose(streakStep) : 0;

    return VOICINGS[tier].map((tone) => ({ ...tone, semitones: tone.semitones + shift }));
}

/**
 * The wrong-guess tone: one quiet note falling a minor third.
 *
 * Below the root and short enough to be over before the shake finishes, so it
 * reads as "registered, not right" rather than as a buzzer. A miss already
 * costs a strike; the sound does not need to punish as well.
 */
export function missVoicing(): ToneSpec[] {
    return [
        { semitones: -5, startAt: 0, duration: 0.14, gain: 0.22, wave: 'triangle', glideTo: -8 },
    ];
}
