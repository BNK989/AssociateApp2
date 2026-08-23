import { describe, it, expect } from 'vitest';
import type { Message } from '@/hooks/useGameLogic';
import {
    BOT_PROFILE,
    BOT_USER_ID,
    buildInitialMessages,
    countRemainingAfterSolve,
    findTargetMessage,
    sanitizeRestoredMessages,
} from './dailyMessages';
import { DEFAULT_HINT_POLICY, type StartLevelReach } from './hintPolicy';

const WORDS = ['Conductor', 'Baton', 'Harmony', 'Chord'];

function makeMessage(overrides: Partial<Message> = {}): Message {
    return {
        id: 'msg-0',
        content: 'Word',
        cipher_length: 4,
        is_solved: false,
        user_id: BOT_USER_ID,
        created_at: '2026-08-21T09:00:00.000Z',
        strikes: 0,
        hint_level: 0,
        ...overrides,
    };
}

/** A policy that opens words at `startLevel`, applied where `appliesTo` says. */
function policyAt(startLevel: number, appliesTo: StartLevelReach = 'first-word') {
    return { ...DEFAULT_HINT_POLICY, startLevel, startLevelAppliesTo: appliesTo };
}

describe('buildInitialMessages', () => {
    it('creates one message per word, in order', () => {
        const messages = buildInitialMessages({ words: WORDS });
        expect(messages).toHaveLength(4);
        expect(messages.map((m) => m.content)).toEqual(WORDS);
        expect(messages.map((m) => m.id)).toEqual(['msg-0', 'msg-1', 'msg-2', 'msg-3']);
    });

    it('gives the player the final word for free', () => {
        const messages = buildInitialMessages({ words: WORDS });
        expect(messages[3].is_solved).toBe(true);
        expect(messages.slice(0, 3).every((m) => !m.is_solved)).toBe(true);
    });

    it('leaves the final word unsolved when it will be typed out on entry', () => {
        const messages = buildInitialMessages({ words: WORDS, animateStartWord: true });
        expect(messages[3].is_solved).toBe(false);
    });

    it('pre-applies the hint level only to the first word the player faces', () => {
        const messages = buildInitialMessages({ words: WORDS, policy: policyAt(2) });
        expect(messages[2].hint_level).toBe(2);
        expect([messages[0], messages[1], messages[3]].every((m) => m.hint_level === 0)).toBe(true);
    });

    it('clamps the hint level into range', () => {
        expect(buildInitialMessages({ words: WORDS, policy: policyAt(99) })[2].hint_level).toBe(3);
        expect(buildInitialMessages({ words: WORDS, policy: policyAt(-5) })[2].hint_level).toBe(0);
    });

    it('attaches an authored hint at level 3, falling back when absent', () => {
        const hints = ['a', 'b', 'authored clue', 'd'];
        expect(buildInitialMessages({ words: WORDS, policy: policyAt(3), hints })[2].ai_hint)
            .toBe('authored clue');

        expect(buildInitialMessages({
            words: WORDS,
            policy: policyAt(3),
            fallbackHint: (w) => `fallback:${w}`,
        })[2].ai_hint).toBe('fallback:Harmony');
    });

    it('attaches no hint below level 3', () => {
        const hints = ['a', 'b', 'authored clue', 'd'];
        expect(buildInitialMessages({ words: WORDS, policy: policyAt(2), hints })[2].ai_hint)
            .toBeUndefined();
    });

    it('opens every unsolved word hinted under every-word', () => {
        const messages = buildInitialMessages({ words: WORDS, policy: policyAt(1, 'every-word') });

        expect(messages.slice(0, 3).every((m) => m.hint_level === 1)).toBe(true);
        // The freebie is already solved; a hint level on it would be meaningless.
        expect(messages[3].hint_level).toBe(0);
    });

    // The setting exists precisely so the board does not give away words the
    // player has not reached; `applyArrivalHint` raises them one at a time.
    it('opens only the first word played under every-word-on-arrival', () => {
        const messages = buildInitialMessages({
            words: WORDS,
            policy: policyAt(2, 'every-word-on-arrival'),
        });

        expect(messages.map((m) => m.hint_level)).toEqual([0, 0, 2, 0]);
    });

    it('carries connection scores through by index', () => {
        const messages = buildInitialMessages({ words: WORDS, connectionScores: [0.1, 0.5, 0.9, 1] });
        expect(messages.map((m) => m.connection_score)).toEqual([0.1, 0.5, 0.9, 1]);
    });

    it('masks every word with a cipher of matching length', () => {
        for (const m of buildInitialMessages({ words: WORDS })) {
            expect([...(m.cipher_text ?? '')]).toHaveLength([...m.content].length);
        }
    });

    it('orders timestamps so the chain sorts as authored', () => {
        const times = buildInitialMessages({ words: WORDS }).map((m) => Date.parse(m.created_at));
        expect([...times].sort((a, b) => a - b)).toEqual(times);
    });
});

describe('findTargetMessage', () => {
    it('returns the last unsolved word, since the chain is solved backwards', () => {
        const messages = [
            makeMessage({ id: 'a' }),
            makeMessage({ id: 'b' }),
            makeMessage({ id: 'c', is_solved: true }),
        ];
        expect(findTargetMessage(messages)?.id).toBe('b');
    });

    it('skips words retired on strikes', () => {
        const messages = [
            makeMessage({ id: 'a' }),
            makeMessage({ id: 'b', strikes: 3 }),
        ];
        expect(findTargetMessage(messages)?.id).toBe('a');
    });

    it('returns undefined once nothing is left in play', () => {
        expect(findTargetMessage([makeMessage({ is_solved: true })])).toBeUndefined();
        expect(findTargetMessage([])).toBeUndefined();
    });
});

describe('countRemainingAfterSolve', () => {
    it('excludes the word just solved', () => {
        const messages = [makeMessage({ id: 'a' }), makeMessage({ id: 'b' })];
        expect(countRemainingAfterSolve(messages, 'b')).toBe(1);
    });

    it('reports zero when that was the last one, ending the game', () => {
        expect(countRemainingAfterSolve([makeMessage({ id: 'a' })], 'a')).toBe(0);
    });

    it('does not count words already retired on strikes', () => {
        const messages = [
            makeMessage({ id: 'a' }),
            makeMessage({ id: 'b', strikes: 3 }),
            makeMessage({ id: 'c', is_solved: true }),
        ];
        expect(countRemainingAfterSolve(messages, 'a')).toBe(0);
    });
});

describe('sanitizeRestoredMessages', () => {
    it('regenerates a level-0 cipher whose length does not match the word', () => {
        const [fixed] = sanitizeRestoredMessages([
            makeMessage({ content: 'Harmony', hint_level: 0, cipher_text: 'xx' }),
        ]);
        expect([...(fixed.cipher_text ?? '')]).toHaveLength(7);
    });

    it('leaves a correctly sized cipher alone', () => {
        const original = makeMessage({ content: 'Word', hint_level: 0, cipher_text: '####' });
        expect(sanitizeRestoredMessages([original])[0].cipher_text).toBe('####');
    });

    it('does not touch ciphers above level 0', () => {
        const original = makeMessage({ content: 'Harmony', hint_level: 2, cipher_text: 'short' });
        expect(sanitizeRestoredMessages([original])[0].cipher_text).toBe('short');
    });

    it('refreshes a stale bot avatar', () => {
        const stale = makeMessage({ profiles: { username: 'Daily Bot', avatar_url: '/old.png' } });
        expect(sanitizeRestoredMessages([stale])[0].profiles).toEqual(BOT_PROFILE);
    });

    it('leaves non-bot messages alone', () => {
        const mine = makeMessage({
            user_id: 'me',
            profiles: { username: 'You', avatar_url: '/mine.png' },
        });
        expect(sanitizeRestoredMessages([mine])[0].profiles?.avatar_url).toBe('/mine.png');
    });

    it('does not mutate the input', () => {
        const original = makeMessage({ content: 'Harmony', hint_level: 0, cipher_text: 'xx' });
        sanitizeRestoredMessages([original]);
        expect(original.cipher_text).toBe('xx');
    });
});
