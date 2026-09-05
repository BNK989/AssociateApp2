# Letter Feedback: what a masked word's colours mean

How a partially-revealed word is drawn, and the one rule that keeps it
learnable. Applies to both modes — every masked word goes through the same
component.

---

## The player's rule

Three states, and each says exactly one thing:

| Tile | Means | Behaviour |
| :--- | :--- | :--- |
| **Green** (`--tile-placed`) | Confirmed in place. The letter belongs exactly here. | Still |
| **Orange** (`--tile-present`) | The letter is in the word. | Still, or drifting when the word is shuffled |
| **Grey** (`--tile-unknown`) | Still hidden. A filler glyph, not a letter. | Still |

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
same state cannot render two ways. The rules that decide state are pure and
tested in `cipher/cipherRules.ts`:

- `computeGuessState(text, guesses)` — `greenIndices` (guessed in position) and
  `revealedChars` (letters shown to be in the answer). `revealedChars` is a set
  of *characters*, so one guess colours every occurrence of that letter.
- `readMaskTile(...)` — one position of a mask into `{ char, state, displaced }`.
  Used by `CipherChars`.
- `buildScrambleItems(...)` — the tiles `ScrambleView` animates, including the
  letter budget that stops a mask leaking a letter the player has not earned.
- `isFillerChar(char)` — filler test, **derived from `CIPHER_SIGNS`** in
  `gameConfig.ts`, the same array the server masks with.

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

Full review, with traced examples and contrast measurements:
`The Orange Problem` (UX review, 2026-09-05).

---

## Still open

Reviewed but deliberately out of the change that produced this document:

- No `prefers-reduced-motion` support anywhere in the app, while the drift runs
  `repeat: Infinity`.
- Colour is the only channel separating placed from present — no shape or
  underline redundancy (WCAG 1.4.1).
- `CipherChars` and `ScrambleView` still differ in *when* they are used: a hint-2
  word renders positionally until a scramble animation has run.
- Green also marks the solve morph and the just-solved ring, so the hue carries
  three meanings.
- Tapping a bubble reshuffles it; the affordance has no copy explaining it.
