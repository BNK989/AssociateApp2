import type { TileState } from './cipherRules';

/**
 * One place where a tile's state becomes a look, shared by both views.
 *
 * `CipherChars` and `ScrambleView` render the same three states and used to
 * disagree about them — the same unearned mask letter was orange in one and
 * full-strength body text in the other, decided only by whether an animation
 * had happened to run yet. A player reading that concludes the colours are
 * arbitrary, because for them they were.
 *
 * Colour comes from CSS variables rather than Tailwind palette classes because
 * one theme is not enough information: a light-theme board carries pale peer
 * bubbles *and* the deep indigo of the player's own messages at the same time,
 * and no single hue is legible on both. Each bubble declares its own set — see
 * `--tile-*` in `globals.css`.
 */
const TILE_COLOR: Record<TileState, string> = {
    placed: 'text-[var(--tile-placed)]',
    present: 'text-[var(--tile-present)]',
    unknown: 'text-[var(--tile-unknown)]',
};

/**
 * Weight separates a letter from filler without relying on hue.
 */
const TILE_WEIGHT: Record<TileState, string> = {
    placed: 'font-bold',
    present: 'font-bold',
    unknown: 'font-medium',
};

/**
 * The second channel: an underline that distinguishes the three states with no
 * reference to colour at all.
 *
 * Green and orange converge under deuteranopia, which affects roughly one man
 * in twelve, and hue was the only thing separating them (WCAG 1.4.1). A solid
 * rule reads as anchored, a dotted one as known-but-not-anchored, and filler
 * carries none — so the states survive greyscale, a colour filter, or a
 * screenshot. Decoration inherits the text colour, so it reinforces rather than
 * competes.
 */
const TILE_UNDERLINE: Record<TileState, string> = {
    placed: 'underline decoration-solid decoration-2 underline-offset-4',
    present: 'underline decoration-dotted decoration-2 underline-offset-4',
    unknown: 'no-underline',
};

/** The glow that lifts a revealed letter off the bubble, themed per surface. */
const TILE_GLOW = 'drop-shadow-[0_0_2px_var(--tile-glow)]';

/** Classes for a single tile in the given state. */
export function tileClassName(state: TileState): string {
    const base = `${TILE_COLOR[state]} ${TILE_WEIGHT[state]} ${TILE_UNDERLINE[state]}`;
    return state === 'unknown' ? base : `${base} ${TILE_GLOW}`;
}
