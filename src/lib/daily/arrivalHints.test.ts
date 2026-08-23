import { describe, expect, it } from 'vitest';
import type { Message } from '@/hooks/useGameLogic';
import { MAX_HINT_LEVEL } from '@/lib/gameConfig';
import { applyArrivalHint } from './arrivalHints';
import { buildInitialMessages } from './dailyMessages';
import { MAX_STRIKES } from './dailyScoring';
import { DEFAULT_HINT_POLICY, type DailyHintPolicy, type StartLevelReach } from './hintPolicy';

const WORDS = ['Conductor', 'Baton', 'Harmony', 'Chord'];

function policyAt(startLevel: number, appliesTo: StartLevelReach): DailyHintPolicy {
    return { ...DEFAULT_HINT_POLICY, startLevel, startLevelAppliesTo: appliesTo };
}

const clue = (index: number, word: string) => `clue for ${word} at ${index}`;

function board(policy: DailyHintPolicy): Message[] {
    return buildInitialMessages({ words: WORDS, policy });
}

/** Marks a word solved, the way the game does when the player gets it. */
function solve(messages: Message[], id: string): Message[] {
    return messages.map((m) => (m.id === id ? { ...m, is_solved: true } : m));
}

describe('applyArrivalHint', () => {
    it('raises the newly active word to the level it is entitled to', () => {
        const policy = policyAt(2, 'every-word-on-arrival');
        // msg-2 opens hinted; msg-1 is next and opens at nothing.
        const after = applyArrivalHint(solve(board(policy), 'msg-2'), policy, clue);

        expect(after.find((m) => m.id === 'msg-1')?.hint_level).toBe(2);
    });

    it('leaves the words the player has not reached alone', () => {
        const policy = policyAt(2, 'every-word-on-arrival');
        const after = applyArrivalHint(solve(board(policy), 'msg-2'), policy, clue);

        expect(after.find((m) => m.id === 'msg-0')?.hint_level).toBe(0);
    });

    it('generates a mask matching the level it applied', () => {
        const policy = policyAt(1, 'every-word-on-arrival');
        const after = applyArrivalHint(solve(board(policy), 'msg-2'), policy, clue);
        const target = after.find((m) => m.id === 'msg-1');

        expect([...(target?.cipher_text ?? '')]).toHaveLength('Baton'.length);
        expect(target?.cipher_text?.[0]).toBe('B');
    });

    it('attaches a clue when the start level is the top of the ladder', () => {
        const policy = policyAt(MAX_HINT_LEVEL, 'every-word-on-arrival');
        const after = applyArrivalHint(solve(board(policy), 'msg-2'), policy, clue);

        expect(after.find((m) => m.id === 'msg-1')?.ai_hint).toBe('clue for Baton at 1');
    });

    it('follows the target past a struck-out word', () => {
        const policy = policyAt(2, 'every-word-on-arrival');
        const struck = board(policy).map((m) => (
            m.id === 'msg-2' ? { ...m, strikes: MAX_STRIKES } : m
        ));

        const after = applyArrivalHint(struck, policy, clue);
        expect(after.find((m) => m.id === 'msg-1')?.hint_level).toBe(2);
    });

    // The other two reaches already carry their level from the board build, so
    // the pass has to be a no-op rather than a second, re-shuffling application.
    it('changes nothing under the up-front reaches', () => {
        for (const appliesTo of ['first-word', 'every-word'] as const) {
            const policy = policyAt(2, appliesTo);
            const messages = solve(board(policy), 'msg-2');

            expect(applyArrivalHint(messages, policy, clue)).toBe(messages);
        }
    });

    it('never walks a word back down the ladder', () => {
        const policy = policyAt(1, 'every-word-on-arrival');
        const climbed = board(policy).map((m) => (
            m.id === 'msg-2' ? { ...m, hint_level: MAX_HINT_LEVEL } : m
        ));

        expect(applyArrivalHint(climbed, policy, clue)).toBe(climbed);
    });

    it('does nothing once every word is finished', () => {
        const policy = policyAt(2, 'every-word-on-arrival');
        const done = board(policy).map((m) => ({ ...m, is_solved: true }));

        expect(applyArrivalHint(done, policy, clue)).toBe(done);
    });

    it('leaves the free starting word unhinted while it is still the target', () => {
        const policy = policyAt(2, 'every-word-on-arrival');
        const animating = buildInitialMessages({
            words: WORDS,
            policy,
            animateStartWord: true,
        });

        expect(applyArrivalHint(animating, policy, clue)).toBe(animating);
    });
});
