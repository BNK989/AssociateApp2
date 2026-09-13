import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useDailySettle } from './useDailySettle';
import { DEFAULT_SETTLE_POLICY, type SettlePolicy } from '@/lib/daily/settlePolicy';
import type { Message } from '@/hooks/useGameLogic';
import { MAX_HINT_LEVEL } from '@/lib/gameConfig';

/**
 * With the anagram switched on.
 *
 * `SCRAMBLE_MASK` ships off — hint 2 reveals its letters in place now, so a
 * suite written against the shuffled mask would quietly stop exercising
 * anything rather than fail. The mechanic still exists behind the switch for a
 * game master to turn back on, so these cases state the premise instead of
 * inheriting it.
 */
vi.mock('@/lib/gameConfig', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/gameConfig')>();
    return { ...actual, SCRAMBLE_MASK: true, maskIsScrambled: (level: number) => level >= 2 };
});


const policy = (over: Partial<SettlePolicy> = {}): SettlePolicy => ({
    ...DEFAULT_SETTLE_POLICY,
    ...over,
});

/**
 * A word at hint level 2 with every letter exposed as an anagram, which is the
 * state the drip is designed for: the player can read all eight letters and has
 * a place for none of them.
 */
const word = (over: Partial<Message> = {}): Message => ({
    id: 'msg-1',
    content: 'STARLING',
    cipher_length: 8,
    is_solved: false,
    user_id: 'daily-bot',
    created_at: new Date().toISOString(),
    strikes: 0,
    hint_level: 2,
    cipher_text: 'GNILRATS',
    guesses: [],
    ...over,
});

function setup(over: {
    message?: Message;
    policy?: SettlePolicy;
    gameOver?: boolean;
} = {}) {
    const onSettled = vi.fn();
    let message = over.message ?? word();

    // A stand-in for the board: `patchTarget` is how every mutation reaches a
    // message, so the drip is only correct if its writes land the same way.
    const patchTarget = vi.fn((_id: string, updates: Partial<Message>) => {
        message = { ...message, ...updates };
    });

    const view = renderHook((props: { message: Message }) => useDailySettle({
        targetMessage: props.message,
        policy: over.policy ?? policy(),
        gameOver: over.gameOver ?? false,
        patchTarget,
        indexOfMessage: () => 1,
        onSettled,
    }), { initialProps: { message } });

    /** Re-renders with whatever `patchTarget` last wrote, as the board would. */
    const flush = () => view.rerender({ message });

    /** Lands whatever is in the air, as the composer's flight does. */
    const land = () => {
        if (view.result.current.pendingIndex !== null) {
            act(() => view.result.current.onLanded());
        }
    };

    /** Advances the clock, then lets any letter it launched finish its flight. */
    const step = (ms: number) => {
        advance(ms);
        land();
    };

    return { view, patchTarget, onSettled, flush, land, step, current: () => message };
}

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

/**
 * Past the commit backstop in `useSettlePlacement`, so a letter that was
 * announced is written even though no flight ever ran. Only used by the test
 * that covers the backstop itself; everything else lands the flight explicitly,
 * because that is the path a real player takes.
 */
const COMMIT_FALLBACK_MS = 700;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('availability', () => {
    it('is available on a word at the arming level with letters to place', () => {
        const { view } = setup();
        expect(view.result.current.available).toBe(true);
    });

    it('is not available below the arming level', () => {
        const { view } = setup({ message: word({ hint_level: 1 }) });
        expect(view.result.current.available).toBe(false);
    });

    it('is not available with an empty pool below the reveal level', () => {
        // The self-gate: nothing found means nothing to place, so the rung
        // cannot fire before the player has been given something to work with.
        const { view } = setup({ message: word({ cipher_text: undefined }) });
        expect(view.result.current.available).toBe(false);
    });

    it('is available at the clue with an empty pool when a game master allows it', () => {
        // Opening unseen letters is off in the shipped policy, so this states
        // the premise. See `settleRules.test.ts` for why it is off.
        const { view } = setup({
            message: word({ hint_level: MAX_HINT_LEVEL, cipher_text: undefined }),
            policy: policy({ revealFromHintLevel: MAX_HINT_LEVEL }),
        });

        expect(view.result.current.available).toBe(true);
        expect(view.result.current.lettersLeft).toBeGreaterThan(0);
    });

    it('is pool-only at the clue by default, which is what ships', () => {
        const { view } = setup({
            message: word({ hint_level: MAX_HINT_LEVEL, cipher_text: undefined }),
        });

        expect(view.result.current.available).toBe(false);
    });

    it('places an opened letter when the player accepts it', () => {
        const { view, patchTarget, land } = setup({
            message: word({ hint_level: MAX_HINT_LEVEL, cipher_text: undefined }),
            policy: policy({ revealFromHintLevel: MAX_HINT_LEVEL }),
        });

        act(() => view.result.current.accept());
        land();

        const [, updates] = patchTarget.mock.calls[0];
        expect(updates.settled_indices).toHaveLength(1);
        // Never the first letter: hint 1 bought that one already.
        expect(updates.settled_indices).not.toContain(0);
    });

    it('is not available once the game is over', () => {
        const { view } = setup({ gameOver: true });
        expect(view.result.current.available).toBe(false);
    });

    it('is not available when the mode is off', () => {
        const { view } = setup({ policy: policy({ mode: 'off' }) });
        expect(view.result.current.available).toBe(false);
    });
});

describe('offered mode', () => {
    it('places nothing until the player accepts', () => {
        const { patchTarget } = setup();
        advance(120_000);
        expect(patchTarget).not.toHaveBeenCalled();
    });

    it('puts a letter in the air the moment the offer is accepted', () => {
        // Accepting has to feel like a reward, not the start of a wait.
        const { view, patchTarget } = setup();

        act(() => view.result.current.accept());

        // Announced, not yet written: the composer needs the letter still in
        // the pool to have something to fly.
        expect(view.result.current.pendingIndex).not.toBeNull();
        expect(patchTarget).not.toHaveBeenCalled();

        act(() => view.result.current.onLanded());

        expect(patchTarget).toHaveBeenCalledTimes(1);
        expect(patchTarget.mock.calls[0][1].settled_indices).toHaveLength(1);
    });

    it('then drips one letter per interval', () => {
        const { view, patchTarget, flush, land, step } = setup({
            policy: policy({ intervalMs: 10_000 }),
        });

        act(() => view.result.current.accept());
        land();
        flush();
        expect(patchTarget).toHaveBeenCalledTimes(1);

        step(10_000);
        flush();
        expect(patchTarget).toHaveBeenCalledTimes(2);

        step(10_000);
        flush();
        expect(patchTarget).toHaveBeenCalledTimes(3);
    });

    it('stops at the allowance rather than finishing the word', () => {
        // STARLING is eight letters; half, leaving at least two, is four.
        const { view, patchTarget, flush, land, step, current } = setup({
            policy: policy({ intervalMs: 1_000 }),
        });

        act(() => view.result.current.accept());
        land();
        flush();

        for (let i = 0; i < 20; i += 1) {
            step(1_000);
            flush();
        }

        expect(current().settled_indices!.length).toBeLessThanOrEqual(4);
        expect(patchTarget.mock.calls.length).toBeLessThanOrEqual(4);
    });

    it('leaves letters for the player to solve', () => {
        const { view, flush, land, step, current } = setup({
            policy: policy({ intervalMs: 1_000 }),
        });

        act(() => view.result.current.accept());
        land();
        flush();
        for (let i = 0; i < 20; i += 1) {
            step(1_000);
            flush();
        }

        const unsettled = current().content.length - current().settled_indices!.length;
        expect(unsettled).toBeGreaterThanOrEqual(DEFAULT_SETTLE_POLICY.minUnsettled);
    });

    it('never places the same position twice', () => {
        const { view, flush, land, step, current } = setup({
            policy: policy({ intervalMs: 1_000 }),
        });

        act(() => view.result.current.accept());
        land();
        flush();
        for (let i = 0; i < 10; i += 1) {
            step(1_000);
            flush();
        }

        const placed = current().settled_indices!;
        expect(new Set(placed).size).toBe(placed.length);
    });
});

describe('auto mode', () => {
    const auto = policy({ mode: 'auto', firstDelayMs: 20_000, intervalMs: 10_000 });

    it('waits out the first delay before placing anything', () => {
        const { view, patchTarget } = setup({ policy: auto });

        advance(19_000);
        expect(view.result.current.pendingIndex).toBeNull();

        advance(2_000);
        expect(view.result.current.pendingIndex).not.toBeNull();

        advance(COMMIT_FALLBACK_MS);
        expect(patchTarget).toHaveBeenCalledTimes(1);
    });

    it('credits a wrong guess as dwell, so a player who missed waits less', () => {
        const { patchTarget, step } = setup({
            message: word({ strikes: 1 }),
            policy: policy({ ...auto, strikeCreditMs: 15_000 }),
        });

        // 5s on the word plus 15s of credit clears the 20s first delay.
        step(6_000);
        expect(patchTarget).toHaveBeenCalledTimes(1);
    });

    it('drains a backlog one letter at a time rather than in a batch', () => {
        // A player returning to a long-backgrounded tab watches the letters
        // arrive rather than finding the work already done. Each one has to
        // wait for the one before it to land, so the writes step up by one and
        // never jump.
        const { patchTarget, flush, step } = setup({ policy: auto });

        for (let i = 0; i < 12; i += 1) {
            step(10_000);
            flush();
        }

        patchTarget.mock.calls.forEach((call, i) => {
            expect(call[1].settled_indices).toHaveLength(i + 1);
        });

        // And the ceiling still binds, however much time was owed.
        expect(patchTarget.mock.calls.length).toBeLessThanOrEqual(4);
        expect(patchTarget.mock.calls.length).toBeGreaterThan(1);
    });

    it('never puts a second letter in the air while one is still flying', () => {
        // Two letters mid-flight would land on top of each other, and the
        // ceiling would be spent before either was written down.
        const { view, patchTarget } = setup({ policy: auto });

        advance(21_000);
        expect(view.result.current.pendingIndex).not.toBeNull();

        const airborne = view.result.current.pendingIndex;
        advance(COMMIT_FALLBACK_MS - 100);

        expect(view.result.current.pendingIndex).toBe(airborne);
        expect(patchTarget).not.toHaveBeenCalled();
    });
});

describe('reporting', () => {
    it('announces each letter with the count and the ceiling, once it lands', () => {
        const { view, onSettled } = setup();

        act(() => view.result.current.accept());
        // Nothing is reported while the letter is in the air: a flight that
        // never arrives must cost the player nothing.
        expect(onSettled).not.toHaveBeenCalled();

        act(() => view.result.current.onLanded());

        expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({
            index: 1,
            settledCount: 1,
            allowance: 4,
            source: 'offered',
        }));
    });

    it('reports auto placements as auto, which is the arm of the experiment', () => {
        const { onSettled, step } = setup({
            policy: policy({ mode: 'auto', firstDelayMs: 1_000 }),
        });

        step(2_000);
        expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({ source: 'auto' }));
    });
});

describe('moving between words', () => {
    it('does not carry an acceptance onto the next word', () => {
        // Accepting on one word is not consent for the game to place letters on
        // every word after it.
        const { view, patchTarget } = setup({ policy: policy({ intervalMs: 5_000 }) });

        act(() => view.result.current.accept());
        patchTarget.mockClear();

        act(() => view.rerender({ message: word({ id: 'msg-2', content: 'PEACOAT', cipher_text: 'TAOCAEP' }) }));

        advance(120_000);
        expect(patchTarget).not.toHaveBeenCalled();
    });
});
