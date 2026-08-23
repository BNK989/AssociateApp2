import type { Message } from '@/hooks/useGameLogic';
import { findTargetMessage } from '@/lib/gameLogic';
import { MAX_HINT_LEVEL } from './dailyScoring';
import { startLevelFor, type DailyHintPolicy } from './hintPolicy';
import { hintLevelUpdates } from './hintVisuals';

/** Clue text for a word, by its position in the chain. */
export type ResolveClue = (index: number, word: string) => string;

/**
 * Raises the word the player has just arrived at to the level the policy
 * entitles it to.
 *
 * Under `every-word-on-arrival` the board is built with only the first word
 * hinted, so every later word needs applying at the moment it becomes the
 * target — which is what this does. Under the other two reaches the level is
 * already on the message from `buildInitialMessages`, so this is a no-op; it is
 * still called on the same paths rather than being conditional, because "the
 * active word is at least at its entitled level" is the invariant, not "this
 * particular setting needs extra work".
 *
 * Only ever raises. A player who climbed the ladder past the start level, or a
 * game master who lowered it mid-day, never has the word walked backwards.
 */
export function applyArrivalHint(
    messages: Message[],
    policy: DailyHintPolicy,
    resolveClue: ResolveClue,
): Message[] {
    const target = findTargetMessage(messages);
    if (!target) return messages;

    const index = messages.indexOf(target);
    const entitled = startLevelFor(policy, index, messages.length);
    const current = target.hint_level || 0;

    if (entitled <= current) return messages;

    const updates = hintLevelUpdates({
        word: target.content,
        currentLevel: current,
        nextLevel: entitled,
        currentCipher: target.cipher_text,
        clue: entitled === MAX_HINT_LEVEL ? resolveClue(index, target.content) : undefined,
    });

    return messages.map((m) => (m.id === target.id ? { ...m, ...updates } : m));
}
