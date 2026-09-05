import { computeGuessState, readMaskTile } from '@/components/cipher/cipherRules';

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
