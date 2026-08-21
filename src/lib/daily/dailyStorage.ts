import type { Message } from '@/hooks/useGameLogic';
import { createLogger } from '@/lib/logger';
import { sanitizeRestoredMessages } from './dailyMessages';

const log = createLogger('daily/storage');

export type DailyGameSnapshot = {
    messages: Message[];
    score: number;
    consecutive: number;
    gameOver: boolean;
};

type StoredSnapshot = DailyGameSnapshot & {
    /** The chain this save belongs to; a mismatch means the puzzle changed. */
    dailyWordsJSON: string;
};

const stateKey = (date: string) => `daily_game_state_${date}`;
const completedKey = (date: string) => `daily_game_completed_${date}`;

/**
 * Restores a day's progress, or null if there is none to restore.
 *
 * The saved chain is compared against today's words: if a puzzle is
 * regenerated (the AI fallback producing a different chain for the same date),
 * the old save is for a different game and must be discarded rather than
 * replayed against the new words.
 */
export function loadDailyGame(date: string, words: string[]): DailyGameSnapshot | null {
    try {
        const raw = localStorage.getItem(stateKey(date));
        if (!raw) return null;

        const parsed = JSON.parse(raw) as StoredSnapshot;
        if (!parsed || parsed.dailyWordsJSON !== JSON.stringify(words)) return null;

        return {
            messages: sanitizeRestoredMessages(parsed.messages),
            score: parsed.score,
            consecutive: parsed.consecutive,
            gameOver: parsed.gameOver,
        };
    } catch (e) {
        log.error('restore', 'Failed to parse saved daily game state', { play_date: date }, e);
        return null;
    }
}

/**
 * Persists progress after every change, so a refresh mid-game resumes exactly.
 * A finished game also writes a flag the lobby reads to dim its daily card.
 */
export function saveDailyGame(date: string, words: string[], snapshot: DailyGameSnapshot): void {
    try {
        const payload: StoredSnapshot = { ...snapshot, dailyWordsJSON: JSON.stringify(words) };
        localStorage.setItem(stateKey(date), JSON.stringify(payload));

        if (snapshot.gameOver) {
            localStorage.setItem(completedKey(date), 'true');
        }
    } catch (e) {
        log.error('save', 'Failed to persist daily game state', { play_date: date }, e);
    }
}

/** Wipes a day's progress, including the lobby's completion flag. */
export function clearDailyGame(date: string): void {
    try {
        localStorage.removeItem(stateKey(date));
        localStorage.removeItem(completedKey(date));
    } catch (e) {
        log.error('clear', 'Failed to clear daily game state', { play_date: date }, e);
    }
}
