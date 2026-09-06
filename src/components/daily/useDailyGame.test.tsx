import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `useTranslations` must hand back a stable function: the game hook derives its
// clue callbacks from it, and a fresh identity per render would re-run the
// restore effect forever.
const translate = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => translate }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { useDailyGame } from './useDailyGame';
import { DEFAULT_HINT_POLICY } from '@/lib/daily/hintPolicy';
import { MAX_STRIKES } from '@/lib/daily/dailyScoring';

const WORDS = ['alpha', 'beta', 'gamma'];
const DATE = '2026-09-06';

type Game = ReturnType<typeof useDailyGame>;
type Overrides = Partial<Parameters<typeof useDailyGame>[0]>;

function setup(overrides: Overrides = {}) {
    return renderHook(() => useDailyGame({
        words: WORDS,
        date: DATE,
        policy: DEFAULT_HINT_POLICY,
        settingsRevision: 1,
        ...overrides,
    }));
}

/** Lets the resolve delay and the flourish timers run out. */
function settle() {
    act(() => { vi.advanceTimersByTime(2000); });
}

/** Plays correctly until only `remaining` words are left in play. */
function solveDownTo(result: { current: Game }, remaining: number) {
    const unsolved = () => result.current.messages.filter((m) => !m.is_solved).length;

    while (unsolved() > remaining) {
        const word = result.current.targetMessage!.content;
        act(() => { result.current.solve(word); });
        settle();
    }
}

function missOnce(result: { current: Game }) {
    act(() => { result.current.solve('nowherenear'); });
    settle();
}

describe('useDailyGame end of chain', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });

    it('ends the game when the last word is solved', () => {
        const { result } = setup();
        solveDownTo(result, 0);

        expect(result.current.gameOver).toBe(true);
    });

    it('ends the game when the last word is given up on', () => {
        const { result } = setup();
        solveDownTo(result, 1);

        act(() => { result.current.giveUp(); });
        settle();

        expect(result.current.gameOver).toBe(true);
    });

    it('ends the game when the last word is struck out', () => {
        const { result } = setup();
        solveDownTo(result, 1);

        for (let i = 0; i < MAX_STRIKES; i += 1) missOnce(result);

        // Regression: the strike path skipped the remaining-words check, so a
        // chain that ended on a third strike left the player on a board with no
        // target and no summary -- and saved that state, so a reload restored it.
        expect(result.current.targetMessage).toBeUndefined();
        expect(result.current.gameOver).toBe(true);
    });

    it('keeps playing while a struck-out word is not the last one', () => {
        const { result } = setup();
        solveDownTo(result, 2);

        for (let i = 0; i < MAX_STRIKES; i += 1) missOnce(result);

        expect(result.current.gameOver).toBe(false);
        expect(result.current.targetMessage).toBeDefined();
    });

    it('persists the finished chain so a reload reopens the summary', () => {
        const first = setup();
        solveDownTo(first.result, 1);
        for (let i = 0; i < MAX_STRIKES; i += 1) missOnce(first.result);
        first.unmount();

        const second = setup();
        expect(second.result.current.gameOver).toBe(true);
        expect(second.result.current.restoredComplete).toBe(true);
    });

    it('reports completion however the chain ended', () => {
        const onCompleted = vi.fn();
        const { result } = setup({ onCompleted });

        solveDownTo(result, 1);
        expect(onCompleted).not.toHaveBeenCalled();

        act(() => { result.current.giveUp(); });
        settle();

        expect(onCompleted).toHaveBeenCalledWith(expect.any(Number), 'gave_up');
    });
});

describe('useDailyGame word reports', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });

    it('reports what is left to play so the board can encourage progress', () => {
        const onWordFinished = vi.fn();
        const { result } = setup({ onWordFinished });

        const word = result.current.targetMessage!.content;
        act(() => { result.current.solve(word); });
        settle();

        expect(onWordFinished).toHaveBeenCalledWith(expect.objectContaining({
            outcome: 'solved',
            remaining: 2,
            consecutive: 1,
            completed: false,
        }));
    });

    it('reports a struck-out word as ending the chain when it was the last', () => {
        const onWordFinished = vi.fn();
        const { result } = setup({ onWordFinished });

        solveDownTo(result, 1);
        for (let i = 0; i < MAX_STRIKES; i += 1) missOnce(result);

        expect(onWordFinished).toHaveBeenLastCalledWith(expect.objectContaining({
            outcome: 'struck_out',
            remaining: 0,
            consecutive: 0,
            completed: true,
        }));
    });
});
