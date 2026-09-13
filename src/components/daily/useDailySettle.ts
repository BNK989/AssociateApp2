import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Message } from '@/hooks/useGameLogic';
import {
    canSettle,
    nextSettleIndex,
    settleAllowance,
    settleArmed,
    settleCandidates,
    settleCountdown,
    settlePressure,
    settlesDueBy,
} from '@/lib/daily/settleRules';
import type { SettlePolicy } from '@/lib/daily/settlePolicy';
import { useSettlePlacement } from './useSettlePlacement';

/**
 * How often the drip re-decides. Well under the smallest sensible interval, and
 * the same shape as `useStuckOffer`'s clock for the same reason: the decision
 * depends on strikes as well as time, so re-deciding on a tick is simpler than
 * rescheduling on every input change.
 */
const TICK_MS = 250;

type UseDailySettleArgs = {
    targetMessage?: Message;
    policy: SettlePolicy;
    gameOver: boolean;
    patchTarget: (id: string, updates: Partial<Message>) => void;
    /** Position of the word in the chain, which is how every event indexes it. */
    indexOfMessage: (id: string) => number;
    /** Announces a letter that has just walked into place. */
    onSettled?: (args: {
        message: Message;
        index: number;
        /** Position in the answer the letter took. */
        slotIndex: number;
        /** How many have settled on this word, counting this one. */
        settledCount: number;
        /** The ceiling for this word, so the event can say how far it got. */
        allowance: number;
        source: 'auto' | 'offered';
    }) => void;
};

/**
 * The settle drip: found letters walking into place, one at a time, for a
 * player who has run out of ladder.
 *
 * **It owns *when*, and nothing else.** Which letter goes next, how many may
 * ever go, and whether there is anything to give are all `settleRules`'
 * decisions — pure and tested, with no clock anywhere near them.
 *
 * The clock is a plain interval rather than a chain of timeouts, and the number
 * of letters owed is *derived from elapsed pressure* rather than counted up
 * tick by tick. That is what makes it survive a backgrounded tab, a re-mount
 * and a restored save: all three converge on the same answer instead of
 * drifting. Letters are still placed one per tick even when several are owed,
 * so each one stays its own event on screen rather than a burst.
 *
 * In `offered` mode the clock does not run at all until the player accepts.
 * That is the whole design rule the stuck machinery already follows — the game
 * offers, the player never asks — and it is also why the first letter lands the
 * instant they accept: accepting has to feel like a reward, not the start of a
 * wait.
 */
/** The drip's state as the ceiling sees it: the airborne letter counts. */
function withPending<T extends { settled: readonly number[] }>(state: T, pending: number | null): T {
    if (pending === null) return state;
    return { ...state, settled: [...state.settled, pending] };
}

export function useDailySettle({
    targetMessage,
    policy,
    gameOver,
    patchTarget,
    indexOfMessage,
    onSettled,
}: UseDailySettleArgs) {
    // Seeded by the effect that starts the clock rather than during render:
    // reading the wall clock during render is impure, and zero is a safe
    // "not started" that `running` already gates on.
    const startedAt = useRef(0);

    /**
     * The clock, tagged with the word it belongs to.
     *
     * One state object rather than three, and reset **during render** rather
     * than in an effect. That is not a style choice: with the reset in an
     * effect, the commit that swapped the word still ran the drip's own effect
     * with the previous word's acceptance and elapsed time, and placed a letter
     * on a word the player had only just reached. Adjusting during render
     * discards the rest of the pass, so no effect ever observes the stale
     * clock. `useSlotTyping` clears its keystrokes the same way.
     */
    const [clock, setClock] = useState<{
        wordId: string | undefined;
        accepted: boolean;
        pressureMs: number;
    }>({ wordId: targetMessage?.id, accepted: false, pressureMs: 0 });

    const targetId = targetMessage?.id;
    const hintLevel = targetMessage?.hint_level ?? 0;
    const strikes = targetMessage?.strikes ?? 0;

    /**
     * Letters this hook has placed on this word.
     *
     * A ref, and counted here rather than read off `settled_indices`, because
     * the board's write is a round trip: `patchTarget` re-renders the tree and
     * the updated message arrives a commit later. Deriving the count from the
     * prop meant the drip could not see its own last placement and immediately
     * placed a second one — which on acceptance handed over two letters for the
     * price of the one the player agreed to.
     *
     * It is also what makes the count honest across a restore: a word coming
     * back from localStorage with letters already settled starts this at zero,
     * so the ceiling still binds (it is checked against `settled_indices`) but
     * the pacing starts fresh rather than believing it is mid-drip.
     */
    const placedHere = useRef(0);

    const settled = useMemo(
        () => targetMessage?.settled_indices ?? [],
        [targetMessage?.settled_indices],
    );

    const {
        pendingIndex,
        launch,
        commit: commitPending,
        clear: clearPending,
    } = useSettlePlacement({
        targetMessage,
        policy,
        settled,
        hintLevel,
        patchTarget,
        indexOfMessage,
        onSettled,
    });

    // A new word is a fresh start: the clock goes back to zero, the player's
    // acceptance does not carry over, and any letter still in the air is
    // forgotten rather than written onto a word it does not belong to.
    // Accepting on one word is not consent for the game to place letters on
    // every word after it.
    if (clock.wordId !== targetId) {
        setClock({ wordId: targetId, accepted: false, pressureMs: 0 });
        placedHere.current = 0;
        startedAt.current = 0;
        clearPending();
    }

    const state = useMemo(
        () => (targetMessage
            ? {
                text: targetMessage.content,
                guesses: targetMessage.guesses ?? [],
                mask: targetMessage.cipher_text
                    ? { cipher: targetMessage.cipher_text, hintLevel }
                    : undefined,
                hintLevel,
                settled,
                policy,
            }
            : null),
        [targetMessage, hintLevel, settled, policy],
    );

    /**
     * Whether the rung exists on this word at all.
     *
     * Two independent questions, and the offer needs both: the word has to be
     * far enough up the ladder, *and* there has to be a letter left to place.
     * A word below the arming level may well have candidates, and offering on
     * it would turn the last rung into a shortcut past the ladder.
     */
    const available = Boolean(
        state
        && !gameOver
        && settleArmed(hintLevel, policy)
        // The letter in the air counts against the ceiling even though it is
        // not written down yet. Without it `canSettle` would hand out one more
        // than the allowance every time a flight was running, and the last word
        // of a tight allowance would come out a letter short for the player.
        && canSettle(withPending(state, pendingIndex)),
    );

    // The clock runs only where it means something: after acceptance in
    // `offered` mode, and from the moment the rung arms in `auto`.
    const running = available && (policy.mode === 'auto' || clock.accepted);

    useEffect(() => {
        if (!running) return;

        if (startedAt.current === 0) startedAt.current = Date.now();

        const timer = setInterval(() => {
            // Reading the clock rather than accumulating ticks, so a
            // backgrounded tab that throttles the interval does not under-count
            // the time the player was away from the word.
            setClock((prev) => ({ ...prev, pressureMs: Date.now() - startedAt.current }));
        }, TICK_MS);

        return () => clearInterval(timer);
    }, [running]);

    /**
     * Places one letter and reports whether it went. Two callers, one move: the drip and an accepted offer let the policy
     * choose, a tapped chip names its own position — which must still be one
     * the drip would have chosen, so a tap cannot outrun the allowance.
     *
     * The ceiling counts this hook's own launches as well as the word's:
     * `settled_indices` is a round trip, so the prop under-reports between a
     * landing and the board catching up.
     */
    const settleOne = useCallback((source: 'auto' | 'offered', at?: number) => {
        if (!targetMessage || !state || gameOver) return false;

        if (Math.max(placedHere.current, settled.length) >= settleAllowance(state.text, policy)) {
            return false;
        }

        // Through `withPending` so a letter still in the air can never be
        // chosen twice, whatever route reached here.
        const pending = withPending(state, pendingIndex);

        const slotIndex = at === undefined ? nextSettleIndex(pending) : at;
        if (slotIndex === null) return false;
        if (at !== undefined && !settleCandidates(pending).includes(at)) return false;

        // Counted at launch, not at landing: the clock has to know a letter is
        // on its way or it would owe another on the very next tick and put two
        // in the air for one interval.
        placedHere.current += 1;
        launch(slotIndex, source);

        return true;
    }, [targetMessage, state, gameOver, pendingIndex, launch, settled.length, policy]);

    /** The player tapping a loose letter: that one, where it belongs. */
    const settleAt = useCallback((at: number) => settleOne('offered', at), [settleOne]);
    /**
     * The player taking the offer up.
     *
     * Lands a letter at once and starts the clock from that moment, so the
     * first interval is counted from the acceptance rather than from whenever
     * the player happened to arrive at the word.
     */
    const accept = useCallback(() => {
        if (clock.accepted || !available) return;

        startedAt.current = Date.now();
        setClock((prev) => ({ ...prev, accepted: true, pressureMs: 0 }));
        settleOne('offered');
    }, [clock.accepted, available, settleOne]);

    /**
     * The player asking for the next letter now rather than waiting it out.
     *
     * The manual counterpart of the drip, and the same move the hint button
     * makes against the ladder — a countdown the player can always pre-empt. It
     * restarts the interval from this moment, so taking one early does not make
     * the next one arrive early too.
     *
     * It is also how the drip starts at all from the composer: a player who
     * never saw the stuck offer, or waved it away, still has the button.
     */
    const settleNow = useCallback(() => {
        if (!available || pendingIndex !== null) return;

        if (!clock.accepted) {
            accept();
            return;
        }

        startedAt.current = Date.now();
        setClock((prev) => ({ ...prev, pressureMs: 0 }));
        placedHere.current = 0;
        settleOne('offered');
    }, [available, pendingIndex, clock.accepted, accept, settleOne]);

    /**
     * How many letters should have been placed on this word by now.
     *
     * `offered` counts the acceptance as the first and one per interval after
     * it; `auto` reads the whole schedule off elapsed pressure. Either way it
     * is *derived from the clock* rather than counted up tick by tick, which is
     * what makes it survive a backgrounded tab, a re-mount and a restored save:
     * all three converge on the same answer instead of drifting apart.
     */
    const owed = !running
        ? 0
        : policy.mode === 'auto'
            ? settlesDueBy(settlePressure({ msOnWord: clock.pressureMs, strikes }, policy), policy)
            : 1 + Math.floor(clock.pressureMs / policy.intervalMs);

    /**
     * The placer, reached through a ref so that the drip is driven by the clock
     * and by nothing else.
     *
     * `settleOne` closes over the message, so its identity changes on every
     * board update — including the one its own placement causes. In the effect's
     * dependency list that made each placement re-trigger the effect, and a
     * player with a backlog of owed letters got one per *render* instead of one
     * per tick: two letters for one tick, and more as the board got busier.
     */
    const place = useRef(settleOne);
    place.current = settleOne;

    // One letter per tick at most, however many are owed, so a player returning
    // to a long-backgrounded tab watches them arrive rather than finding the
    // work already done. Keyed on `pressureMs` so a backlog drains a letter a
    // tick; in steady state the tick that changes `owed` is the one that places.
    useEffect(() => {
        if (!running || pendingIndex !== null || owed <= placedHere.current) return;
        place.current(policy.mode === 'auto' ? 'auto' : 'offered');
        // Driven by the clock alone; `place` is a ref for the reason above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running, owed, clock.pressureMs, policy.mode, pendingIndex]);

    const countdown = settleCountdown(
        settlePressure({ msOnWord: clock.pressureMs, strikes }, policy),
        policy,
        clock.accepted || placedHere.current > 0,
    );

    return {
        /** Whether the stuck ladder may offer this rung on the current word. */
        available,
        /** Whether letters are currently landing on this word. */
        running,
        accept,
        settleNow,
        settleAt,
        settledIndices: settled,
        /** The letter in the air, which the composer flies and then reports back. */
        pendingIndex,
        onLanded: commitPending,
        /** 0–100 toward the next letter. Counts *up*: a full ring is a landing. */
        progress: running ? countdown.progressPercent : 0,
        secondsLeft: running ? Math.max(0, Math.ceil(countdown.msUntilNext / 1000)) : 0,
        /** Letters the drip may still place on this word, the airborne one included. */
        lettersLeft: state
            ? Math.max(0, settleAllowance(state.text, policy) - settled.length)
            : 0,
    };
}
