import { describe, it, expect } from 'vitest';
import type { GameState, Message, Player } from '@/hooks/useGameLogic';
import {
    countActivePlayers,
    countUpFrame,
    countUpStepSize,
    getActivePlayerId,
    getTeamFlowProgress,
    isScoreLeader,
    sortPlayersForStack,
} from './headerRules';

const ME = 'user-me';
const THEM = 'user-them';

function makePlayer(user_id: string, overrides: Partial<Player> = {}): Player {
    return {
        user_id,
        score: 0,
        joined_at: '2026-08-21T09:00:00.000Z',
        consecutive_correct_guesses: 0,
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

const message = { id: 'm1', user_id: THEM } as Message;

describe('getActivePlayerId', () => {
    it('highlights whoever is up while texting', () => {
        expect(getActivePlayerId(makeGame())).toBe(ME);
    });

    it('highlights the author of the word being guessed while solving', () => {
        // Not the guesser — the player whose word is on the block.
        expect(getActivePlayerId(makeGame({ status: 'solving' }), message)).toBe(THEM);
    });

    it('falls back to the turn holder while solving with no target yet', () => {
        expect(getActivePlayerId(makeGame({ status: 'solving' }))).toBe(ME);
    });
});

describe('sortPlayersForStack', () => {
    it('moves the active player to the end so they paint on top', () => {
        const players = [makePlayer('a'), makePlayer('b'), makePlayer('c')];
        expect(sortPlayersForStack(players, 'a').map((p) => p.user_id)).toEqual(['b', 'c', 'a']);
    });

    it('leaves the order alone when the active player is unknown', () => {
        const players = [makePlayer('a'), makePlayer('b')];
        expect(sortPlayersForStack(players, undefined).map((p) => p.user_id)).toEqual(['a', 'b']);
    });

    it('does not mutate the input', () => {
        const players = [makePlayer('a'), makePlayer('b')];
        sortPlayersForStack(players, 'a');
        expect(players.map((p) => p.user_id)).toEqual(['a', 'b']);
    });
});

describe('getTeamFlowProgress', () => {
    it('fills across a fever cycle and wraps', () => {
        expect(getTeamFlowProgress(0)).toBe(0);
        expect(getTeamFlowProgress(1)).toBe(20);
        expect(getTeamFlowProgress(4)).toBe(80);
        expect(getTeamFlowProgress(5)).toBe(0);
        expect(getTeamFlowProgress(6)).toBe(20);
    });

    it('treats missing streaks as zero', () => {
        expect(getTeamFlowProgress(null)).toBe(0);
        expect(getTeamFlowProgress(undefined)).toBe(0);
    });
});

describe('isScoreLeader', () => {
    it('is true for the top scorer', () => {
        const players = [makePlayer(ME, { score: 10 }), makePlayer(THEM, { score: 5 })];
        expect(isScoreLeader(players, ME)).toBe(true);
        expect(isScoreLeader(players, THEM)).toBe(false);
    });

    it('counts a tie at the top as leading', () => {
        const players = [makePlayer(ME, { score: 7 }), makePlayer(THEM, { score: 7 })];
        expect(isScoreLeader(players, ME)).toBe(true);
    });

    it('has no leader before anyone scores', () => {
        const players = [makePlayer(ME), makePlayer(THEM)];
        expect(isScoreLeader(players, ME)).toBe(false);
    });

    it('handles an empty roster without returning Infinity', () => {
        expect(isScoreLeader([], ME)).toBe(false);
    });
});

describe('countActivePlayers', () => {
    it('excludes players who left', () => {
        const players = [makePlayer('a'), makePlayer('b', { has_left: true }), makePlayer('c')];
        expect(countActivePlayers(players)).toBe(2);
    });
});

describe('countUpStepSize', () => {
    it('closes any distance in roughly ten frames', () => {
        expect(countUpStepSize(0, 100)).toBe(10);
        expect(countUpStepSize(0, 45)).toBe(5);
    });

    it('never returns zero, so an animation cannot stall', () => {
        expect(countUpStepSize(0, 1)).toBe(1);
        expect(countUpStepSize(50, 50)).toBe(1);
    });

    it('is direction-agnostic', () => {
        expect(countUpStepSize(100, 0)).toBe(countUpStepSize(0, 100));
    });
});

describe('countUpFrame', () => {
    it('advances by exactly one step while far from the target', () => {
        expect(countUpFrame(0, 100, 10)).toBe(10);
        expect(countUpFrame(10, 100, 10)).toBe(20);
    });

    it('snaps to the target once within a step', () => {
        expect(countUpFrame(95, 100, 10)).toBe(100);
        expect(countUpFrame(99, 100, 1)).toBe(100);
    });

    it('counts down as well as up', () => {
        expect(countUpFrame(100, 0, 10)).toBe(90);
        expect(countUpFrame(5, 0, 10)).toBe(0);
    });

    it('stays put when already at the target', () => {
        expect(countUpFrame(50, 50, 5)).toBe(50);
    });

    it('reaches the target in the expected number of frames', () => {
        // The step is fixed for the run, so movement is linear rather than easing.
        const target = 100;
        const step = countUpStepSize(0, target);
        let value = 0;
        let frames = 0;

        while (value !== target && frames < 50) {
            value = countUpFrame(value, target, step);
            frames++;
        }

        expect(value).toBe(target);
        expect(frames).toBe(10);
    });
});
