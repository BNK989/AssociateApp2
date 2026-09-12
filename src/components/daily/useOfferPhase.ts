import { useCallback, useEffect, useState } from 'react';
import { holdMsFor, phaseAfterHold, type OfferPhase } from '@/lib/daily/offerPresentation';
import type { StuckOfferKind } from '@/lib/daily/stuckSignals';

/**
 * The clock that takes an offer off the board.
 *
 * `useStuckOffer` decides *what* the game has to say; this decides how long it
 * says it for. They are separate because the answer to "is this player stuck"
 * is game logic and the answer to "has this been on screen long enough" is not,
 * and mixing them was what left every offer sitting over the board until the
 * word changed.
 *
 * Each kind gets one turn at full width. When it runs out a remark is gone and
 * an actionable offer collapses to a chip — see `offerPresentation.ts` for why
 * the two differ.
 *
 * **Reopening is final.** A player who taps the chip open has asked for it, and
 * taking it away again a few seconds later would be the game arguing with them.
 * It then stays until they act on it, wave it away, or the word changes.
 */
export function useOfferPhase(kind: StuckOfferKind | null) {
    /**
     * The phase the clock has moved this offer into, tagged with the offer it
     * belongs to. Tagging is what makes the reset free: an offer that escalates
     * mid-word arrives with a kind the settled phase does not match, so it
     * reads as expanded without anything having to clear the old value.
     */
    const [settled, setSettled] = useState<{ kind: StuckOfferKind; phase: OfferPhase } | null>(null);

    const phase: OfferPhase = settled && settled.kind === kind ? settled.phase : 'expanded';

    useEffect(() => {
        if (!kind) return;

        const timer = setTimeout(
            () => setSettled({ kind, phase: phaseAfterHold(kind) }),
            holdMsFor(kind),
        );

        return () => {
            clearTimeout(timer);
            // An offer's turn ends with the offer. Without this the record
            // outlives it, and the next word's remark is born already faded --
            // the game falls silent between words, so the same kind comes back
            // to a phase it has already spent.
            setSettled(null);
        };
        // Deliberately not re-armed on `expand`: the hold is the game's one
        // attempt at stepping aside politely, not a loop the player has to
        // fight. See the note above.
    }, [kind]);

    /** Opens a collapsed offer back up, for good. */
    const expand = useCallback(() => setSettled(null), []);

    return { phase, expand };
}
