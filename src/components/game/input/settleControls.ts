/**
 * The settle drip as the composer needs it.
 *
 * Its own module so the board, the composer and the control that draws it all
 * name the same shape — the drip's state crosses three components and a
 * structural type repeated at each would drift silently.
 *
 * Optional wherever it appears: a multiplayer room has no drip, and the
 * composer falls back to the reveal at max hints exactly as it always did.
 */
export type SettleControls = {
    /** Whether the drip still has a letter to give on this word. */
    available: boolean;
    /** Whether letters are already arriving on their own. */
    running: boolean;
    /** Letters the drip may still place, the one in the air included. */
    lettersLeft: number;
    /** Seconds until the next one, or 0 when the drip is not running. */
    secondsLeft: number;
    /** 0–100 toward the next letter. Counts *up*: a full ring is a landing. */
    progress: number;
    /**
     * The position a letter is flying to, while it is in the air.
     *
     * The composer binds this to its slot so the flight has both ends to
     * measure; the letter is only written down once `onLanded` fires.
     */
    pendingIndex: number | null;
    /** Take the next letter now rather than waiting the interval out. */
    onSettleNow: () => void;
    /**
     * Put *this* position's letter in place — the player tapped its chip.
     *
     * Costs what any settled letter costs, and refuses wherever the drip would:
     * past the ceiling, or on a position it would not have chosen. Tapping used
     * to type the letter at the caret, which is what a keystroke does and not
     * what anyone expected — the letters are the word's own, so tapping one
     * plainly means *put it where it goes*.
     */
    onSettleAt: (slotIndex: number) => void;
    /** Called once the flight lands, which is when the letter is written. */
    onLanded: () => void;
};
