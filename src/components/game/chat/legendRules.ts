import { computeGuessState, readMaskTile } from '@/components/cipher/cipherRules';
import type { TileState } from '@/components/cipher/cipherRules';
import { CIPHER_SIGNS } from '@/lib/gameConfig';

type ColouredTilesArgs = {
    /** The answer itself, which the client holds even while it is masked. */
    text: string;
    cipherText?: string | null;
    guesses?: string[] | null;
    hintLevel: number;
};

/**
 * Whether this word is showing the player a tile that carries colour yet.
 *
 * The colour key is worth explaining at exactly one moment — the first tile that
 * stops being filler — so the question is asked of the same function the board
 * draws with rather than approximated from `hint_level`. A word can colour a
 * tile from a guess alone at hint level 0, and a masked word at level 1 can
 * legitimately expose nothing if the mask happens to be all filler.
 */
export function hasColouredTiles({
    text,
    cipherText,
    guesses,
    hintLevel,
}: ColouredTilesArgs): boolean {
    const maskChars = [...(cipherText ?? '')];
    const guessState = computeGuessState(text, guesses ?? []);

    return [...text].some(
        (char, i) => readMaskTile(maskChars[i], char, i, guessState, hintLevel).state !== 'unknown',
    );
}

/** One example character per tile state, keyed by the state it demonstrates. */
export type LegendSamples = Record<TileState, string>;

/**
 * The key's examples when the word itself cannot supply one.
 *
 * Only ever reached for a state the current word is not showing — a word with
 * no green tile yet has no green letter to point at, and inventing one from the
 * answer would hand the player a letter they have not earned.
 */
export const DEFAULT_LEGEND_SAMPLES: LegendSamples = {
    placed: 'A',
    present: 'B',
    unknown: CIPHER_SIGNS[0],
};

/**
 * Example tiles drawn from the word the key is explaining.
 *
 * An abstract `A` / `B` / `⊗` key asks the player to map three inventions onto
 * the three tiles in front of them. Taking the first tile of each state from
 * the live word removes that step: the green in the key is *their* green.
 *
 * Nothing is leaked by this. Every character comes back through `readMaskTile`,
 * the same reader the board draws with, so a letter can only appear here if it
 * is already on screen above; a state the word has not reached falls back to
 * the generic sample.
 */
export function pickLegendSamples({
    text,
    cipherText,
    guesses,
    hintLevel,
}: ColouredTilesArgs): LegendSamples {
    const maskChars = [...(cipherText ?? '')];
    const guessState = computeGuessState(text, guesses ?? []);
    const samples = { ...DEFAULT_LEGEND_SAMPLES };
    const taken = new Set<TileState>();

    [...text].forEach((char, i) => {
        if (char === ' ') return;

        const tile = readMaskTile(maskChars[i], char, i, guessState, hintLevel);
        if (taken.has(tile.state) || !tile.char || tile.char === ' ') return;

        taken.add(tile.state);
        // The board renders the opening tile capitalised whenever a word is being
        // solved, and the key is only ever open on the word being solved.
        samples[tile.state] = i === 0 ? tile.char.toUpperCase() : tile.char;
    });

    return samples;
}
