import { describe, it, expect } from 'vitest';
import type { GameState, Message } from '@/hooks/useGameLogic';
import {
    deriveMessageFlags,
    getMessagesLeftWarning,
    shouldShowStrikeLabel,
} from './messageFlags';

const ME = 'user-me';
const THEM = 'user-them';

function makeMessage(overrides: Partial<Message> = {}): Message {
    return {
        id: 'msg-1',
        content: 'Coffee',
        cipher_length: 6,
        is_solved: false,
        user_id: THEM,
        created_at: '2026-08-21T09:00:00.000Z',
        strikes: 0,
        hint_level: 0,
        ...overrides,
    };
}

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

function derive(message: Message, game: GameState, extra: Partial<Parameters<typeof deriveMessageFlags>[0]> = {}) {
    return deriveMessageFlags({
        message,
        isLastMessage: false,
        game,
        currentUserId: ME,
        targetMessageId: undefined,
        isRevealed: false,
        ...extra,
    });
}

describe('deriveMessageFlags — visibility', () => {
    it('reveals a solved message', () => {
        expect(derive(makeMessage({ is_solved: true }), makeGame()).isVisible).toBe(true);
    });

    it('reveals the newest message while texting', () => {
        const flags = derive(makeMessage(), makeGame({ status: 'texting' }), { isLastMessage: true });
        expect(flags.isVisible).toBe(true);
    });

    it('hides the newest message once solving starts', () => {
        const flags = derive(makeMessage(), makeGame({ status: 'solving' }), { isLastMessage: true });
        expect(flags.isVisible).toBe(false);
    });

    it('hides older unsolved messages while texting', () => {
        expect(derive(makeMessage(), makeGame()).isVisible).toBe(false);
    });
});

describe('deriveMessageFlags — outcome', () => {
    it('treats a solved message worth points as correct', () => {
        const flags = derive(makeMessage({ is_solved: true, winner_points: 40 }), makeGame());
        expect(flags.isCorrect).toBe(true);
        expect(flags.isFailed).toBe(false);
    });

    it('treats a solved message worth nothing as a give-up', () => {
        const flags = derive(makeMessage({ is_solved: true, winner_points: 0 }), makeGame());
        expect(flags.isFailed).toBe(true);
        expect(flags.isCorrect).toBe(false);
    });

    it('treats three strikes as failed', () => {
        const flags = derive(makeMessage({ is_solved: true, strikes: 3 }), makeGame());
        expect(flags.isFailed).toBe(true);
    });

    it('never marks the daily seed word as failed', () => {
        // The daily game hands the player its opening word already solved and
        // worth nothing; that must not render as a loss.
        const flags = derive(
            makeMessage({ is_solved: true, winner_points: 0 }),
            makeGame({ id: 'daily-game' }),
            { isLastMessage: true },
        );
        expect(flags.isFailed).toBe(false);
    });

    it('still marks an ordinary daily word as failed', () => {
        const flags = derive(
            makeMessage({ is_solved: true, winner_points: 0 }),
            makeGame({ id: 'daily-game' }),
            { isLastMessage: false },
        );
        expect(flags.isFailed).toBe(true);
    });
});

describe('deriveMessageFlags — indicators', () => {
    it('shows the strike indicator mid-run on a hidden message', () => {
        const flags = derive(makeMessage({ strikes: 2 }), makeGame({ status: 'solving' }));
        expect(flags.showStrikeIndicator).toBe(true);
        expect(flags.strikes).toBe(2);
    });

    it('hides the strike indicator when there are no strikes', () => {
        expect(derive(makeMessage(), makeGame()).showStrikeIndicator).toBe(false);
    });

    it('allows shuffling a partially revealed word', () => {
        const flags = derive(makeMessage({ hint_level: 2 }), makeGame({ status: 'solving' }));
        expect(flags.canShuffle).toBe(true);
        expect(flags.needsExtraPadding).toBe(true);
    });

    it('does not allow shuffling once an admin has revealed the word', () => {
        const flags = derive(makeMessage({ hint_level: 2 }), makeGame({ status: 'solving' }), { isRevealed: true });
        expect(flags.canShuffle).toBe(false);
    });

    it('does not allow shuffling below hint level 2', () => {
        const flags = derive(makeMessage({ hint_level: 1 }), makeGame({ status: 'solving' }));
        expect(flags.canShuffle).toBe(false);
    });
});

describe('deriveMessageFlags — identity', () => {
    it('identifies the viewer own message', () => {
        expect(derive(makeMessage({ user_id: ME }), makeGame()).isMe).toBe(true);
        expect(derive(makeMessage({ user_id: THEM }), makeGame()).isMe).toBe(false);
    });

    it('marks the active solve target only while solving', () => {
        const message = makeMessage({ id: 'target' });
        expect(derive(message, makeGame({ status: 'solving' }), { targetMessageId: 'target' }).isTarget).toBe(true);
        expect(derive(message, makeGame({ status: 'texting' }), { targetMessageId: 'target' }).isTarget).toBe(false);
    });
});

describe('deriveMessageFlags — lifecycle stage', () => {
    const solving = makeGame({ status: 'solving' });

    it('marks the word being solved as active', () => {
        const flags = derive(makeMessage(), solving, { targetMessageId: 'msg-1' });
        expect(flags.stage).toBe('active');
        expect(flags.isDimmed).toBe(false);
    });

    it('marks a solved word as settled', () => {
        expect(derive(makeMessage({ is_solved: true }), solving).stage).toBe('settled');
    });

    it('marks an unreached word as upcoming and holds it back', () => {
        const flags = derive(makeMessage(), solving, { targetMessageId: 'msg-other' });
        expect(flags.stage).toBe('upcoming');
        expect(flags.isDimmed).toBe(true);
    });

    it('never dims outside the solving phase', () => {
        expect(derive(makeMessage(), makeGame({ status: 'texting' })).isDimmed).toBe(false);
    });
});

describe('deriveMessageFlags — hint display', () => {
    const solving = makeGame({ status: 'solving' });
    const hinted = { hint_level: 3, ai_hint: 'A low, throaty sound.' };

    it('shows nothing when the word carries no clue', () => {
        expect(derive(makeMessage(), solving, { targetMessageId: 'msg-1' }).hintDisplay).toBe('none');
    });

    it('opens the clue on the word being solved', () => {
        const flags = derive(makeMessage(hinted), solving, { targetMessageId: 'msg-1' });
        expect(flags.hintDisplay).toBe('open');
    });

    it('opens the clue while it is still being fetched', () => {
        const flags = derive(makeMessage({ hint_level: 3 }), solving, { targetMessageId: 'msg-1' });
        expect(flags.hintDisplay).toBe('open');
    });

    it('collapses the clue once the word is settled', () => {
        const flags = derive(makeMessage({ ...hinted, is_solved: true }), solving);
        expect(flags.hintDisplay).toBe('collapsed');
    });

    it('withholds a clue on a word the player has not reached yet', () => {
        const flags = derive(makeMessage(hinted), solving, { targetMessageId: 'msg-other' });
        expect(flags.hintDisplay).toBe('none');
    });

    it('withholds nothing while texting, where there is no word to look ahead to', () => {
        expect(derive(makeMessage(hinted), makeGame({ status: 'texting' })).hintDisplay).toBe('open');
    });
});

describe('getMessagesLeftWarning', () => {
    it('warns on the final three messages', () => {
        const game = makeGame({ max_messages: 25 });
        expect(getMessagesLeftWarning(game, 22)).toBe(2);
        expect(getMessagesLeftWarning(game, 23)).toBe(1);
    });

    it('stays quiet while the cap is still far away', () => {
        expect(getMessagesLeftWarning(makeGame({ max_messages: 25 }), 5)).toBeNull();
    });

    it('stays quiet once the cap is reached', () => {
        expect(getMessagesLeftWarning(makeGame({ max_messages: 25 }), 24)).toBeNull();
    });

    it('stays quiet while solving or with no cap set', () => {
        expect(getMessagesLeftWarning(makeGame({ max_messages: 25, status: 'solving' }), 23)).toBeNull();
        expect(getMessagesLeftWarning(makeGame(), 23)).toBeNull();
    });
});

describe('shouldShowStrikeLabel', () => {
    it('keeps the label for words with room for it', () => {
        expect(shouldShowStrikeLabel('Association')).toBe(true);
    });

    it('drops the label on short words', () => {
        expect(shouldShowStrikeLabel('Sun')).toBe(false);
    });
});
