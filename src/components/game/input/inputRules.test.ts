import { describe, it, expect } from 'vitest';
import type { GameState, Message, Player } from '@/hooks/useGameLogic';
import { calculateMessageValue, HINT_COSTS } from '@/lib/gameLogic';
import { getNextHintLevel } from '@/lib/daily/dailyScoring';
import {
    countMeaningfulChars,
    getActivePlayerId,
    getEffectiveHintLevel,
    getHintTier,
    getTurnState,
    isSubmitDisabled,
} from './inputRules';

const ME = 'user-me';
const AUTHOR = 'user-author';

function makeGame(overrides: Partial<GameState> = {}): GameState {
    return {
        id: 'game-1',
        handle: 1,
        status: 'texting',
        mode: 'free',
        current_turn_user_id: ME,
        team_pot: 0,
        team_consecutive_correct: 0,
        fever_mode_remaining: 0,
        solve_proposal_confirmations: [],
        ...overrides,
    };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
    return {
        id: 'msg-1',
        content: 'Harmony',
        cipher_length: 7,
        is_solved: false,
        user_id: AUTHOR,
        created_at: '2026-08-21T09:00:00.000Z',
        strikes: 0,
        hint_level: 0,
        guesses: [],
        ...overrides,
    };
}

function makePlayer(user_id: string, overrides: Partial<Player> = {}): Player {
    return {
        user_id,
        score: 0,
        joined_at: '2026-08-21T09:00:00.000Z',
        consecutive_correct_guesses: 0,
        ...overrides,
    };
}

const turnArgs = (overrides = {}) => ({
    game: makeGame({ status: 'solving' as const }),
    players: [makePlayer(ME), makePlayer(AUTHOR)],
    targetMessage: makeMessage(),
    currentUserId: ME,
    solvingTimeLeft: 10,
    isSinglePlayer: false,
    ...overrides,
});

describe('getActivePlayerId', () => {
    it('is the turn holder while texting', () => {
        expect(getActivePlayerId(makeGame(), makeMessage())).toBe(ME);
    });

    it('is the target word author while solving', () => {
        expect(getActivePlayerId(makeGame({ status: 'solving' }), makeMessage())).toBe(AUTHOR);
    });

    it('falls back to the turn holder when solving with no target', () => {
        expect(getActivePlayerId(makeGame({ status: 'solving' }))).toBe(ME);
    });
});

describe('getTurnState', () => {
    it('locks the word to its author inside the window', () => {
        const state = getTurnState(turnArgs());
        expect(state.isMyTurn).toBe(false);
        expect(state.isFreeForAll).toBe(false);
    });

    it('recognises my own word', () => {
        const state = getTurnState(turnArgs({ targetMessage: makeMessage({ user_id: ME }) }));
        expect(state.isMyTurn).toBe(true);
    });

    it('opens up once the timer has run out', () => {
        expect(getTurnState(turnArgs({ solvingTimeLeft: 0 })).isFreeForAll).toBe(true);
    });

    it('is always open in a single-player game', () => {
        expect(getTurnState(turnArgs({ isSinglePlayer: true })).isFreeForAll).toBe(true);
    });

    it('opens up when the author has left, so the word stays answerable', () => {
        const state = getTurnState(turnArgs({
            players: [makePlayer(ME), makePlayer(AUTHOR, { has_left: true })],
        }));
        expect(state.isFreeForAll).toBe(true);
        expect(state.targetPlayerHasLeft).toBe(true);
    });
});

describe('isSubmitDisabled', () => {
    const base = { game: makeGame(), sending: false, isEmpty: false, isMyTurn: true, isFreeForAll: false };

    it('blocks while a guess is in flight', () => {
        expect(isSubmitDisabled({ ...base, sending: true })).toBe(true);
    });

    it('lets anyone seed the first word of an empty chain', () => {
        expect(isSubmitDisabled({ ...base, isEmpty: true, isMyTurn: false })).toBe(false);
    });

    it('blocks off-turn texting', () => {
        expect(isSubmitDisabled({ ...base, isMyTurn: false })).toBe(true);
        expect(isSubmitDisabled({ ...base, isMyTurn: true })).toBe(false);
    });

    it('allows an off-turn solve once it is free for all', () => {
        const solving = { ...base, game: makeGame({ status: 'solving' }), isMyTurn: false };
        expect(isSubmitDisabled(solving)).toBe(true);
        expect(isSubmitDisabled({ ...solving, isFreeForAll: true })).toBe(false);
    });
});

describe('getEffectiveHintLevel', () => {
    it('matches the stored level when nothing is known', () => {
        expect(getEffectiveHintLevel(makeMessage({ hint_level: 0 }))).toBe(0);
        expect(getEffectiveHintLevel(makeMessage({ hint_level: 2 }))).toBe(2);
    });

    it('counts level 1 as spent when guesses exposed the first letter', () => {
        // Level 1 reveals the first letter; the button must not offer it again.
        expect(getEffectiveHintLevel(makeMessage({ hint_level: 0, guesses: ['hxx'] }))).toBe(1);
    });

    it('does not skip when guesses miss the first letter', () => {
        expect(getEffectiveHintLevel(makeMessage({ hint_level: 0, guesses: ['zzz'] }))).toBe(0);
    });

    it('counts level 2 as spent when the word is already mostly revealed', () => {
        const guesses = [...new Set('Harmony'.toLowerCase().split(''))];
        expect(getEffectiveHintLevel(makeMessage({ hint_level: 1, guesses }))).toBe(2);
    });

    it('returns 0 with no target', () => {
        expect(getEffectiveHintLevel(undefined)).toBe(0);
    });
});

describe('getHintTier', () => {
    const message = makeMessage();
    const value = calculateMessageValue(message.content);
    const ladder = 'STEP';

    it('prices each tier off the word value', () => {
        expect(getHintTier(0, message, ladder)?.cost).toBe(Math.ceil(value * HINT_COSTS.TIER_1));
        expect(getHintTier(1, message, ladder)?.cost).toBe(Math.ceil(value * HINT_COSTS.TIER_2));
        expect(getHintTier(2, message, ladder)?.cost).toBe(Math.ceil(value * HINT_COSTS.TIER_3));
    });

    it('labels each tier', () => {
        expect(getHintTier(0, message, ladder)?.labelKey).toBe('reveal_len');
        expect(getHintTier(1, message, ladder)?.labelKey).toBe('hint_2');
        expect(getHintTier(2, message, ladder)?.labelKey).toBe('hint_ai');
    });

    it('shows the step glyph on the ladder', () => {
        expect(getHintTier(1, message, ladder)?.badge).toBe('shuffle');
        expect(getHintTier(2, message, ladder)?.badge).toBe('ai');
    });

    it('shows no glyph under the ALL reveal type, since no step is passed through', () => {
        for (const level of [0, 1, 2]) {
            expect(getHintTier(level, message, 'ALL')?.badge).toBeNull();
        }
    });

    it('returns nothing once hints are exhausted, or with no target', () => {
        expect(getHintTier(3, message, ladder)).toBeNull();
        expect(getHintTier(0, undefined, ladder)).toBeNull();
    });
});

describe('hint cost and hint level agree', () => {
    const word = { id: 'm1', content: 'Harmony' } as Message;

    // These drifted apart under the old 'ALL' default: the button priced the
    // next hint at its tier (10% at level 0) while getNextHintLevel jumped
    // straight to level 3 and calculateSolvePoints deducted 60%. The player
    // was charged six times what the button offered.
    it('prices the step the player will actually be moved to', () => {
        const value = calculateMessageValue(word.content);

        expect(getNextHintLevel({ currentLevel: 0, word: word.content, guesses: [] })).toBe(1);
        expect(getHintTier(0, word)?.cost).toBe(Math.ceil(value * HINT_COSTS.TIER_1));

        expect(getNextHintLevel({ currentLevel: 1, word: word.content, guesses: [] })).toBe(2);
        expect(getHintTier(1, word)?.cost).toBe(Math.ceil(value * HINT_COSTS.TIER_2));
    });

    it('shows the step glyph now that the ladder is real', () => {
        expect(getHintTier(0, word)?.badge).toBe('level');
        expect(getHintTier(1, word)?.badge).toBe('shuffle');
        expect(getHintTier(2, word)?.badge).toBe('ai');
    });
});


describe('countMeaningfulChars', () => {
    it('ignores spaces wherever they fall', () => {
        expect(countMeaningfulChars('a b c')).toBe(3);
        expect(countMeaningfulChars('  a  b  ')).toBe(2);
        expect(countMeaningfulChars('')).toBe(0);
    });
});
