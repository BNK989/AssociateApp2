import { describe, expect, it, afterEach } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { MAX_HINT_LEVEL, MAX_STRIKES } from '@/lib/daily/dailyScoring';
import { DEFAULT_HINT_POLICY, type DailyHintPolicy, type StartLevelReach } from '@/lib/daily/hintPolicy';
import { DEMO_WORDS } from './demoChain';
import { useDemoGame } from './useDemoGame';

afterEach(() => cleanup());

/**
 * Automatic hints are off in every policy here: the countdown has its own tests
 * against the real scheduler, and leaving it armed would make these assertions
 * race a timer rather than test the board.
 */
function policy(overrides: Partial<DailyHintPolicy> = {}): DailyHintPolicy {
    return {
        ...DEFAULT_HINT_POLICY,
        rungs: DEFAULT_HINT_POLICY.rungs.map((r) => ({ ...r })) as DailyHintPolicy['rungs'],
        autoEnabled: false,
        ...overrides,
    };
}

function startingAt(startLevel: number, appliesTo: StartLevelReach): DailyHintPolicy {
    return policy({ startLevel, startLevelAppliesTo: appliesTo });
}

/** The word the demo player is on, typed in and submitted. */
function solveTarget(result: { current: ReturnType<typeof useDemoGame> }) {
    const word = result.current.targetMessage?.content ?? '';
    act(() => result.current.setGuess(word));
    act(() => result.current.submit());
}

describe('useDemoGame', () => {
    it('opens on the demo chain with the last word given away', () => {
        const { result } = renderHook(() => useDemoGame(policy()));

        expect(result.current.messages.map((m) => m.content)).toEqual([...DEMO_WORDS]);
        expect(result.current.messages.at(-1)?.is_solved).toBe(true);
        expect(result.current.targetMessage?.content).toBe(DEMO_WORDS[DEMO_WORDS.length - 2]);
    });

    it('scrambles the whole board up front under every-word', () => {
        const { result } = renderHook(() => useDemoGame(startingAt(2, 'every-word')));

        expect(result.current.messages.map((m) => m.hint_level)).toEqual([2, 2, 2, 0]);
    });

    // This is the difference the demo exists to show: same entitlement, but the
    // board is not handed over in advance.
    it('scrambles only the current word under every-word-on-arrival', () => {
        const { result } = renderHook(() => useDemoGame(startingAt(2, 'every-word-on-arrival')));

        expect(result.current.messages.map((m) => m.hint_level)).toEqual([0, 0, 2, 0]);
    });

    it('raises the next word as the player reaches it', () => {
        const { result } = renderHook(() => useDemoGame(startingAt(2, 'every-word-on-arrival')));
        solveTarget(result);

        expect(result.current.messages.map((m) => m.hint_level)).toEqual([0, 2, 2, 0]);
        expect(result.current.targetMessage?.content).toBe(DEMO_WORDS[1]);
    });

    it('scores a solve and moves on', () => {
        const { result } = renderHook(() => useDemoGame(policy()));
        solveTarget(result);

        expect(result.current.score).toBeGreaterThan(0);
        expect(result.current.messages[2].is_solved).toBe(true);
    });

    // The setting a game master reaches for after raising the start level, and
    // the one whose effect is invisible without playing a word.
    it('pays more for the same solve when free hints are not charged for', () => {
        const charged = renderHook(() => useDemoGame(
            policy({ startLevel: 2, startLevelAppliesTo: 'every-word', chargeForStartLevel: true }),
        ));
        const free = renderHook(() => useDemoGame(
            policy({ startLevel: 2, startLevelAppliesTo: 'every-word', chargeForStartLevel: false }),
        ));

        solveTarget(charged.result);
        solveTarget(free.result);

        expect(free.result.current.score).toBeGreaterThan(charged.result.current.score);
    });

    it('takes a strike for a wrong guess', () => {
        const { result } = renderHook(() => useDemoGame(policy()));

        act(() => result.current.setGuess('definitely not the word'));
        act(() => result.current.submit());

        expect(result.current.targetMessage?.strikes).toBe(1);
        expect(result.current.score).toBe(0);
    });

    it('moves past a word once it is struck out', () => {
        const { result } = renderHook(() => useDemoGame(policy()));

        for (let i = 0; i < MAX_STRIKES; i += 1) {
            act(() => result.current.setGuess(`wrong guess ${i}`));
            act(() => result.current.submit());
        }

        expect(result.current.targetMessage?.content).toBe(DEMO_WORDS[1]);
    });

    it('climbs the ladder one rung at a time on a manual hint', () => {
        const { result } = renderHook(() => useDemoGame(policy()));

        act(() => result.current.revealHint());
        expect(result.current.targetMessage?.hint_level).toBe(1);
    });

    it('goes straight to the clue under a jump progression', () => {
        const { result } = renderHook(() => useDemoGame(policy({ progression: 'jump' })));

        act(() => result.current.revealHint());
        expect(result.current.targetMessage?.hint_level).toBe(MAX_HINT_LEVEL);
        expect(result.current.targetMessage?.ai_hint).toBeTruthy();
    });

    it('gives up a word for nothing and carries on', () => {
        const { result } = renderHook(() => useDemoGame(policy()));

        act(() => result.current.giveUp());

        expect(result.current.score).toBe(0);
        expect(result.current.targetMessage?.content).toBe(DEMO_WORDS[1]);
    });

    it('ends once the chain is finished', () => {
        const { result } = renderHook(() => useDemoGame(policy()));

        for (let i = 0; i < DEMO_WORDS.length - 1; i += 1) solveTarget(result);

        expect(result.current.gameOver).toBe(true);
        expect(result.current.targetMessage).toBeUndefined();
    });

    // A preview that wrote to the day's save would hand the game master's own
    // daily game whatever they were experimenting with.
    it('leaves no trace in storage', () => {
        const { result } = renderHook(() => useDemoGame(policy()));
        solveTarget(result);

        expect(window.localStorage.length).toBe(0);
    });
});
