import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message } from '@/hooks/useGameLogic';
import { createLogger } from '@/lib/logger';
import { settleAllowance } from '@/lib/daily/settleRules';
import type { SettlePolicy } from '@/lib/daily/settlePolicy';
import type { SettleSource } from '@/lib/daily/dailyAnalytics';

const log = createLogger('daily/settle');

/**
 * How long a letter may stay in the air before it is written down anyway.
 *
 * The commit normally happens when the flight reports it has landed, which is
 * the only thing that knows the real duration. This is the backstop for the
 * cases where no flight ever runs or ever finishes: `prefers-reduced-motion`,
 * a chip or cell that could not be measured, or a scroll mid-flight, which
 * lands every flight at once on purpose. Comfortably past `MAX_MS` in
 * `flightPath`, so it never pre-empts a real landing.
 */
const COMMIT_FALLBACK_MS = 700;

type UseSettlePlacementArgs = {
    targetMessage?: Message;
    policy: SettlePolicy;
    /** Positions already written onto the word. */
    settled: readonly number[];
    hintLevel: number;
    patchTarget: (id: string, updates: Partial<Message>) => void;
    indexOfMessage: (id: string) => number;
    onSettled?: (args: {
        message: Message;
        index: number;
        slotIndex: number;
        settledCount: number;
        allowance: number;
        source: SettleSource;
    }) => void;
};

/**
 * Settling a letter, in two phases, so that it can be seen to travel.
 *
 * The phases are not ceremony — they are what makes the animation possible at
 * all. The moment a letter is written into `settled_indices` it counts as
 * placed, which takes it out of the pool, which unmounts its halo chip; and a
 * chip that has unmounted has no rectangle to fly from. So the letter is
 * *announced* first and written *second*: the composer keeps it in the pool,
 * binds it to the slot it is heading for, and `useLetterFlights` launches it
 * exactly as it would a letter the player had typed.
 *
 * Everything else in the game reads an announced letter as not settled yet, so
 * the ceiling, the candidate list, the score and the analytics all count it
 * once — at the moment it arrives, never the moment it set off. A flight that
 * never lands therefore costs the player nothing.
 */
export function useSettlePlacement({
    targetMessage,
    policy,
    settled,
    hintLevel,
    patchTarget,
    indexOfMessage,
    onSettled,
}: UseSettlePlacementArgs) {
    /** The letter currently in the air, as a position in the answer. */
    const [pendingIndex, setPendingIndex] = useState<number | null>(null);

    /** Which trigger launched it, held for the event it will fire on landing. */
    const sourceOfPending = useRef<SettleSource>('offered');

    /** Announces a letter and puts it in the air. */
    const launch = useCallback((slotIndex: number, source: SettleSource) => {
        sourceOfPending.current = source;
        setPendingIndex(slotIndex);
    }, []);

    /** Forgets an airborne letter without writing it, when the word moves on. */
    const clear = useCallback(() => setPendingIndex(null), []);

    /**
     * Writes the letter that has just landed onto the word.
     *
     * This is where a settled letter becomes real. Guarded against a double
     * call, because both the flight's own landing and the fallback timer below
     * point at it.
     */
    const commit = useCallback(() => {
        if (pendingIndex === null || !targetMessage) return;

        const slotIndex = pendingIndex;
        const source = sourceOfPending.current;
        setPendingIndex(null);

        const next = [...settled, slotIndex];
        const allowance = settleAllowance(targetMessage.content, policy);

        patchTarget(targetMessage.id, { settled_indices: next });

        log.debug('place', 'A found letter walked into place', {
            word_index: indexOfMessage(targetMessage.id),
            slot_index: slotIndex,
            settled: next.length,
            allowance,
            hint_level: hintLevel,
            source,
        });

        onSettled?.({
            message: targetMessage,
            index: indexOfMessage(targetMessage.id),
            slotIndex,
            settledCount: next.length,
            allowance,
            source,
        });
    }, [
        pendingIndex, targetMessage, settled, policy,
        patchTarget, indexOfMessage, hintLevel, onSettled,
    ]);

    // The backstop. A flight that never runs or never finishes must not leave a
    // letter stranded in the air, so the write happens anyway.
    const commitRef = useRef(commit);
    useEffect(() => {
        commitRef.current = commit;
    }, [commit]);

    useEffect(() => {
        if (pendingIndex === null) return;

        const timer = setTimeout(() => commitRef.current(), COMMIT_FALLBACK_MS);
        return () => clearTimeout(timer);
    }, [pendingIndex]);

    return { pendingIndex, launch, commit, clear };
}
