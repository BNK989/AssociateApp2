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

    it('ends the game when the last word is revealed', () => {
        const { result } = setup();
        solveDownTo(result, 1);

        act(() => { result.current.revealWord(); });
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

        act(() => { result.current.revealWord(); });
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
            // Two words solved on the way down, one step back for the word
            // that got away -- the streak decays, it does not collapse.
            consecutive: 1,
            completed: true,
        }));
    });
});

describe('useDailyGame near misses', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });

    /** 'beta' with one letter wrong: close enough to remark on, not to accept. */
    const nearMiss = (result: { current: Game }) => {
        act(() => { result.current.solve('beto'); });
        settle();
    };

    /**
     * Puts 'beta' in play. The chain is solved backwards and its last word is
     * typed out on entry, so the first target is 'gamma' -- five letters, where
     * a one-letter slip clears MATCH_THRESHOLD and is simply accepted. The band
     * only bites on shorter words, which is the whole point of it.
     */
    const openBeta = (result: { current: Game }) => {
        solveDownTo(result, 2);
        expect(result.current.targetMessage!.content).toBe('beta');
    };

    it('does not charge a strike for the first near miss on a word', () => {
        const { result } = setup();
        openBeta(result);

        nearMiss(result);

        expect(result.current.targetMessage!.strikes).toBe(0);
        expect(result.current.targetMessage!.near_misses).toBe(1);
    });

    it('charges the second one, so the forgiveness cannot be farmed', () => {
        const { result } = setup();
        openBeta(result);

        nearMiss(result);
        nearMiss(result);

        expect(result.current.targetMessage!.strikes).toBe(1);
        expect(result.current.targetMessage!.near_misses).toBe(1);
    });

    it('still charges a guess that was nowhere near', () => {
        const { result } = setup();
        openBeta(result);

        missOnce(result);

        expect(result.current.targetMessage!.strikes).toBe(1);
        expect(result.current.targetMessage!.near_misses).toBe(0);
    });

    it('reports the miss with how close it was and what it cost', () => {
        const onMissed = vi.fn();
        const { result } = setup({ onMissed });
        openBeta(result);

        nearMiss(result);
        expect(onMissed).toHaveBeenLastCalledWith(expect.objectContaining({
            index: 1,
            band: 'near',
            strikeForgiven: true,
        }));

        missOnce(result);
        expect(onMissed).toHaveBeenLastCalledWith(expect.objectContaining({
            band: 'off',
            strikeForgiven: false,
        }));
    });
});

describe('useDailyGame streak', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });

    it('does not punish the streak for a wrong guess on a word still in play', () => {
        const { result } = setup();

        solveDownTo(result, 2);
        expect(result.current.consecutive).toBe(1);

        missOnce(result);

        // The word keeps its own strike; the run the player is building does
        // not pay for the same mistake a second time.
        expect(result.current.consecutive).toBe(1);
    });

    it('costs one step, not the whole run, when a word is revealed', () => {
        const { result } = setup();

        solveDownTo(result, 1);
        expect(result.current.consecutive).toBe(2);

        act(() => { result.current.revealWord(); });
        settle();

        expect(result.current.consecutive).toBe(1);
    });
});
