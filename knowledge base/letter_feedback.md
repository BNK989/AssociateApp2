# Letter Feedback: what a masked word's colours mean

How a partially-revealed word is drawn, and the one rule that keeps it
learnable. Applies to both modes — every masked word goes through the same
component.

---

## The player's rule

Three states, and each says exactly one thing:

| Tile | Means | Underline | Behaviour |
| :--- | :--- | :--- | :--- |
| **Green** (`--tile-placed`) | Confirmed in place. The letter belongs exactly here. | Solid | Still |
| **Orange** (`--tile-present`) | The letter is in the word. | Dotted | Still, or drifting when the word is shuffled |
| **Grey** (`--tile-unknown`) | Still hidden. A filler glyph, not a letter. | None | Still |

The underline is a **second channel**, carrying the same three states with no
reference to hue. Green and orange converge under deuteranopia and hue used to
be the only thing separating them (WCAG 1.4.1); the states now survive
greyscale, a colour filter, or a screenshot.

The invariant everything else follows from:

> **Orange never claims anything about position.** It says only that the letter
> is in the answer. Whether its slot means anything is stated separately, by the
> board and by the legend, never by the colour.

Below hint level 2 the mask is built position by position, so revealed letters
sit where they belong. From hint level 2 the mask is an *anagram* of the answer
and order stops carrying information. The legend says which applies
(`ordered_note` / `shuffled_note`), and the drifting animation marks the tiles
whose slots are meaningless.

**Motion means one thing: this slot is not the letter's own.** Anything settled
is drawn still, so stillness is what marks a position as trustworthy. Green
therefore never moves.

Under `prefers-reduced-motion` a displaced tile **keeps its tilt and loses the
drift**. A static angle is not movement, and it is the only per-tile cue that a
slot is meaningless, so dropping it would cost the signal entirely; the endless
vertical drift is the part that troubles vestibular sensitivity. `motionState()`
in `cipherVariants.ts` owns that mapping so it cannot be applied in one view and
forgotten in the other.

### Where the player meets the rule

- `LetterLegend` (`src/components/game/LetterLegend.tsx`) — the key itself,
  rendered from the same `--tile-*` variables the board uses, so the samples are
  the exact colours on screen.
- **The palette button** in the input row (`input/LegendButton.tsx`), available
  for the whole of solving, showing only the half of the position rule that
  currently applies.
- **How to play** (`info/HowToPlayDialog.tsx`), both modes, showing both halves.
- **The daily walkthrough**, step 3 (`GameRoom.Info.Daily.tutorial.step3_*`).

---

## Technical flow

```
MessageBubble                     declares the tile palette for its surface
  └─ CipherText                   picks a view, owns the animation
       ├─ CipherChars             positional view (any hint level)
       └─ ScrambleView            shuffled view (hint 2+, after a scramble runs)
```

Both views take their look from **one** place, `cipher/tileStyles.ts`, so the
same state cannot render two ways. **Which** view runs is derived from the word's
state, not from what has happened to it: `useCipherAnimation` seeds
`scrambleItems` at mount for any word already at hint 2, so a word scrolled into
view on a seeded board does not render positionally and then change look for no
visible reason.

The rules that decide state are pure and tested in `cipher/cipherRules.ts`:

- `computeGuessState(text, guesses)` — `greenIndices` (guessed in position) and
  `revealedChars` (letters shown to be in the answer). `revealedChars` is a set
  of *characters*, so one guess colours every occurrence of that letter.
- `readMaskTile(...)` — one position of a mask into `{ char, state, displaced }`.
  Used by `CipherChars`.
- `buildScrambleItems(...)` — the tiles `ScrambleView` animates, including the
  letter budget that stops a mask leaking a letter the player has not earned.
- `isFillerChar(char)` — filler test, **derived from `CIPHER_SIGNS`** in
  `gameConfig.ts`, the same array the server masks with.

`cipher/cipherVariants.ts` owns how a tile is *drawn in motion*: `tiltSeed(id)`
keys a tile's angle to its identity rather than its slot (passing the array
index re-rolled every tilt on every shuffle, producing exactly the twitching the
derivation exists to avoid), and `motionState()` maps `{flashing, displaced,
reduced}` onto a variant.

> **`CIPHER_SIGNS` contains astral glyphs** (`🜁`, `🜂`, …), which are surrogate
> pairs. Index and slice masks **by code point** — `[...cipher][i]`, never
> `cipher[i]` — or a single astral glyph shifts every index after it.

### Colour is per surface, not per theme

A light-theme board shows pale `bg-gray-300` peer bubbles and deep
`bg-indigo-600` own-message bubbles at the same time, and no single green or
orange is legible on both. So the palette is CSS variables scoped to the bubble
(`--tile-placed`, `--tile-present`, `--tile-unknown`, `--tile-glow` in
`globals.css`), and `MessageBubble` adds `.tile-surface-own` to the player's own
messages. Every value clears 4.5:1 against the surface it is scoped to.

**Adding a surface means adding a `--tile-*` set for it.** A new bubble
background without one inherits the theme's peer palette and will silently fail
contrast.

---

## Why it is built this way

Three defects motivated the current shape; each has a test guarding it.

1. **Orange used to claim "wrong spot"** while the renderer drew the letter at
   its true index. `BANANA` guessed with `SNAKE` showed five of six letters, all
   correctly placed, all labelled wrong — the copy invited players to rule out
   the one arrangement that was right.
2. **The filler test did not match the filler.** `SPECIAL_CHARS` was a
   hand-written ASCII list documented as matching `gameLogic.ts` that shared no
   character with `CIPHER_SIGNS`. Every real mask glyph failed the "is this
   filler?" test and was styled as a revealed letter, so letters and noise
   looked identical. The unit tests used the fictional ASCII alphabet, which is
   why nothing caught it — fixtures now use `CIPHER_SIGNS`.
3. **Pinned letters drifted.** The float was gated on "is a real letter" rather
   than "is loose", so green tiles bobbed exactly like unplaced ones and motion
   carried no signal.
4. **Green meant three things** — placed, resolving, solved. The collision that
   mattered was on *letters*: mid-reveal, the unresolved tail was painted green
   at the one moment the player watches tiles most closely. It is now toned as
   filler, which is what it is. The bubble-level success green (the just-solved
   ring, the spine, the points float) is deliberately kept: it fires when the
   word is fully revealed and no coloured tiles are on screen, and green-for-
   success is a strong convention worth more than the theoretical tidiness.

Full review, with traced examples and contrast measurements:
`The Orange Problem` (UX review, 2026-09-05).

---

## Still open

- Tapping anywhere on a hint-2 bubble reshuffles it, not just the shuffle
  button. The button is the discoverable path and its tooltip now explains that
  a shuffle reveals nothing new; the whole-bubble hit target remains
  undocumented.
- Under reduced motion, a displaced tile and an ordered one differ only by tilt,
  which is subtle. The word-level rule is still stated in the legend, so the
  information is available, just not per tile.
- `CipherText.test.tsx` drives real timers and takes ~7s for four tests.
