import { useCallback, useEffect, useRef } from 'react';
import { createLogger } from '@/lib/logger';

const log = createLogger('daily/client');

const SUCCESS_SOUND_SRC = '/sounds/notifications/correct-choice.mp3';
const SUCCESS_SOUND_VOLUME = 0.6;

/** Preloads the solve chime so the first correct answer is not silent. */
export function useSuccessSound() {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = new Audio(SUCCESS_SOUND_SRC);
        audio.volume = SUCCESS_SOUND_VOLUME;
        audio.preload = 'auto';
        audioRef.current = audio;
    }, []);

    return useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = 0;
        audio.play().catch((e) => log.warn('play_audio', 'Success sound playback failed', undefined, e));
    }, []);
}
