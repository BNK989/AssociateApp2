import {
    buildScrambleItems,
    computeGuessState,
    isFillerChar,
    readMaskTile,
} from '@/components/cipher/cipherRules';
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

/** Example characters per tile state, keyed by the state they demonstrate. */
export type LegendSamples = Record<TileState, string[]>;

/**
 * How many examples each state is worth.
 *
 * Orange gets the most because it is the state a player has to reason about:
 * one lone letter reads as an arbitrary choice, four reads as "these are the
 * letters you have found". Green is usually one or two letters and grey is
 * noise, so neither earns more room than it needs.
 */
const SAMPLE_CAPS: Record<TileState, number> = { placed: 2, present: 4, unknown: 1 };

/**
 * The key's examples when the word itself cannot supply one.
 *
 * Only ever reached for a state the current word is not showing — a word with
 * no green tile yet has no green letter to point at, and inventing one from the
 * answer would hand the player a letter they have not earned.
 */
export const DEFAULT_LEGEND_SAMPLES: LegendSamples = {
    placed: ['A'],
    present: ['B'],
    unknown: [CIPHER_SIGNS[0]],
};

/** One tile as the board would draw it: what it shows and what that means. */
type SampleTile = { char: string; state: TileState };

/**
 * Example tiles drawn from the word the key is explaining.
 *
 * An abstract `A` / `B` / `⊗` key asks the player to map three inventions onto
 * the three tiles in front of them. Taking the tiles from the live word removes
 * that step: the green in the key is *their* green.
 *
 * The states are read from whichever view is actually on screen. That is the
 * whole difficulty: `readMaskTile` calls every mask letter `present` from hint
 * level 2, because in a positional reading an anagram's slots mean nothing —
 * but `ScrambleView`, which is what the player is looking at from that level,
 * pins the letters it knows and paints those green. Reading the shuffled board
 * through the positional rule reported no green at all, so the key fell back to
 * a stand-in `A` while a green `W` sat directly above it.
 *
 * Nothing leaks either way: both readers are the ones the board draws with, so
 * a letter can only appear here if it is already on screen.
 */
export function pickLegendSamples(args: ColouredTilesArgs): LegendSamples {
    const tiles = args.hintLevel >= 2 ? scrambleTiles(args) : maskTiles(args);
    const picked: LegendSamples = { placed: [], present: [], unknown: [] };

    tiles.forEach(({ char, state }, i) => {
        if (!char || char === ' ') return;
        if (picked[state].length >= SAMPLE_CAPS[state]) return;
        // The board renders the opening tile capitalised whenever a word is being
        // solved, and the key is only ever open on the word being solved.
        picked[state].push(i === 0 ? char.toUpperCase() : char);
    });

    return {
        placed: picked.placed.length ? picked.placed : DEFAULT_LEGEND_SAMPLES.placed,
        present: picked.present.length ? picked.present : DEFAULT_LEGEND_SAMPLES.present,
        unknown: picked.unknown.length ? picked.unknown : DEFAULT_LEGEND_SAMPLES.unknown,
    };
}

/** The positional view (`CipherChars`), used below hint level 2. */
function maskTiles({ text, cipherText, guesses, hintLevel }: ColouredTilesArgs): SampleTile[] {
    const maskChars = [...(cipherText ?? '')];
    const guessState = computeGuessState(text, guesses ?? []);

    return [...text].map((char, i) => {
        const tile = readMaskTile(maskChars[i], char, i, guessState, hintLevel);
        return { char: tile.char, state: tile.state };
    });
}

/**
 * The shuffled view (`ScrambleView`), used from hint level 2.
 *
 * The state mapping is `ScrambleView`'s own: a pinned real letter is placed, a
 * loose one is present, everything else is filler.
 */
function scrambleTiles({ text, cipherText, guesses, hintLevel }: ColouredTilesArgs): SampleTile[] {
    const cipherChars = [...(cipherText ?? '')];

    const items = buildScrambleItems({
        textChars: [...text],
        cipherChars,
        guessState: computeGuessState(text, guesses ?? []),
        hintLevel,
        // Deterministic, so a sample tile does not change glyph on every render.
        pickFiller: () => cipherChars.find(isFillerChar) ?? CIPHER_SIGNS[0],
    });

    return items.map((item) => ({
        char: item.char,
        state: item.isReal
            ? (item.locked ? 'placed' : 'present')
            : 'unknown',
    }));
}
