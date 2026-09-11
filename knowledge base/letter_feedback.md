# Letter Feedback: what a masked word's colours mean

How a partially-revealed word is drawn, and the one rule that keeps it
learnable. Applies to both modes — every masked word goes through the same
component.

---

## The player's rule

Three states, and each says exactly one thing:

| Tile | Means | Underline | Where it appears |
| :--- | :--- | :--- | :--- |
| **Green** (`--tile-placed`) | Confirmed in place. The letter belongs exactly here. | Solid | The word line, and the composer's strip |
| **Orange** (`--tile-present`) | Found, but with no confirmed place. | Dotted | **The pool only** — never inside the word line, and never in the answer's order |
| **Grey** (`--tile-unknown`) | Still hidden. A filler glyph, not a letter. | None | The word line |

> **Orange left the word line on 2026-09-11.** The invariant below was true and
> unlearnable, because a line of glyphs asserts sequence louder than any styling
> can deny it. Rather than add a sixth channel to the argument, the unordered
> half moved out of the line entirely — see *The letter pool* below.

The underline is a **second channel**, carrying the same three states with no
reference to hue. Green and orange converge under deuteranopia and hue used to
be the only thing separating them (WCAG 1.4.1); the states now survive
greyscale, a colour filter, or a screenshot.

The invariant everything else follows from:

> **Orange never claims anything about position.** It says only that the letter
> is in the answer. Whether its slot means anything is stated separately, by the
> board and by the legend, never by the colour.

This binds the pool as a *collection*, not only its tiles. A row in the answer's
order claims a great deal about position no matter what each tile says — see
*The pool had an order* below.

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
  the exact colours on screen. Its sample *characters* are a prop: generic
  `A` / `B` / a filler glyph where there is no word to point at (the dialog, the
  palette popover), and the live word's own tiles wherever there is one.
- **The bubble itself**, the first time a word of theirs colours a tile
  (`chat/InlineLegend.tsx` + `chat/useLegendIntro.ts`). This is the only route
  that is *pushed* rather than waited for, and it is the one that reaches a
  player who does not yet know there is a key to look for. It opens inside the
  bubble, under the word it explains, in the condensed `inline` variant of
  `LetterLegend`; it closes on the next guess, on dismiss, or when the word
  settles, and it never opens again on that device
  (`associ8-legend-intro-seen`). Its samples are `pickLegendSamples`
  (`chat/legendRules.ts`) — tiles taken from the word directly above, so the
  green in the key is the player's own green rather than a letter they have to
  map onto theirs. Up to two greens, **four** oranges and one filler sign: a
  single orange reads as an arbitrary pick, several read as "the letters you
  have found". A state the word has not reached falls back to the generic
  sample, and nothing can leak, because the characters come from the same
  readers the board draws with — which is also the trap: `readMaskTile` is the
  right reader only below hint level 2. From level 2 the player is looking at
  `ScrambleView`, which pins known letters and paints them green, while the
  positional reader calls every letter of an anagram `present`. Reading a
  shuffled word the positional way reported *no* green at all, so the key
  showed a stand-in `A` while a green `W` sat in the bubble above it. The picker
  therefore switches readers at level 2, exactly as `CipherText` does.
  `hasColouredTiles`, in the same module, decides the *moment* by asking
  `readMaskTile` rather than inferring it from `hint_level`, because a guess can
  colour a tile at level 0 and an all-filler mask can colour none at level 1.
- **The palette button** in the input row (`input/LegendButton.tsx`), available
  for the whole of solving, showing only the half of the position rule that
  currently applies. It costs 48px of the composer, and whether it earns that
  is now a measured question rather than an argued one — see `legend_opened` in
  [events.md](events.md).
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

## The letter pool (composer half, landed 2026-09-11)

The invariant above — *orange never claims anything about position* — was true
and unlearnable. A line of glyphs means sequence, so a letter drawn inside one
is read as being *at* that spot no matter what is done to it, and by 2026-09-11
the renderer was spending five channels (hue, weight, a dotted underline, a
seeded tilt, an endless drift) arguing against that single fact. The conflict is
structural: the word line was being asked to carry an ordered thing and an
unordered thing at once.

So the unordered half leaves the line.

### What the player sees

Found-but-unplaced letters live in a **pool** docked above the composer, outside
the sentence. A tile that is not in the word cannot be misread as a position in
it — the rule stops being something to remember and becomes something visible.

The composer then draws the answer's **shape**: one slot per letter, greens
pre-filled, and the caret jumping over them so the player types only the gaps
and never retypes a letter they earned. Typing a letter that is in the pool
draws that tile down into the slot. Placing is an act, not an inference.

| Piece | Where |
| :--- | :--- |
| The rules, pure and tested | `src/lib/letterPool/poolRules.ts` (43 tests) |
| Typed ↔ pool ↔ strip binding | `src/components/game/input/useSlotTyping.ts` (11 tests) |
| The pool | `src/components/game/pool/` |
| The strip | `src/components/game/input/SlotStrip.tsx`, `SlotCell.tsx` |
| Motion contract | `src/components/game/pool/poolMotion.ts` |
| Keyframes and cell sizing | `src/app/letter-pool.css` |
| Compiled floor | `LETTER_POOL` in `gameConfig.ts` |

### It reveals nothing new

Greens at their index, the found letters, the word's length, its spaces and its
repeat counts are all already on screen — the length via the `typed / total`
counter, the repeat counts via the letter budget in `buildScrambleItems`. The
strip appears behind **exactly the gate the counter had** (single player, or
hint level 1+) and *replaces* it, so the composer's height is unchanged.

Punctuation is given rather than guessed, for the same reason spaces always
were: the strip already discloses the shape, and asking where an apostrophe
falls tests typing, not association.

### Long phrases

Cells group into words; the strip wraps **between** groups, never inside one, so
"morning glory" is two lines of full-size cells rather than thirteen cramped
ones. Cell width is then sized against the longest single *word* — the only run
that has to fit on a line — as a container query, not a measured value:

```
--slot-w: clamp(18px, (100cqi - 24px - gaps) / longest-word, 32px)
```

18px is where a mono glyph stops being readable; 32px is where the cells start
to look like a different game from the word above them. No `ResizeObserver`, and
it re-solves on a keyboard opening or a rotation for free.

### Why it stays smooth

The composer is the one surface a player touches continuously, so the motion
rules are constraints, not preferences. They live in `poolMotion.ts`:

1. **Only `transform` and `opacity` animate.** A placed letter leaves its socket
   behind rather than being removed from the pool, so the row never reflows.
   Cell widths are fixed per word, so a keystroke changes only what is drawn
   inside a cell.
2. **Springs, not durations.** A spring retargets from its current velocity, so
   typing faster than the animation never queues a backlog or snaps.
3. **Idle drift is a CSS keyframe, not a framer `repeat: Infinity`.** A
   repeating framer animation keeps a JS loop alive per tile — which the board
   already pays for every masked word — while a keyframe runs on the compositor.
   Above `MAX_DRIFTING_TILES` (12) the drift switches off entirely: motion is a
   signal, and every tile emitting it at once is noise.
4. **No flight from the bubble to the pool.** The bubble sits inside the
   scrolling message list and framer's layout projection across a scroll
   container reports stale positions, so the tile would launch from the wrong
   place. A newly found letter springs into being in the pool instead. The
   pool → slot flight, the one that carries the meaning, is a `layoutId` handoff
   entirely inside the composer, where there is no scroll container to fight.
5. **Reduced motion** drops drift and handoff and keeps the static tilt, the
   same split `motionState()` already makes.

### The word line (landed the same day)

`readMaskTile` takes a `hideUnplaced` flag, defaulted from `LETTER_POOL.ENABLED`,
and under it the line draws **only what it can say honestly**: confirmed letters,
spaces, and filler. A letter with no confirmed place is replaced by a filler
glyph chosen from its index — from the index, not at random, because this one is
picked on the render path and a fresh glyph per frame would make hidden
positions shimmer.

Two consequences follow:

- **The shuffled view is gone.** It existed to say "these slots mean nothing";
  with nothing loose left in the line, every slot means something. `CipherText`
  passes `scrambling: false`, `messageFlags.canShuffle` is off, and the shuffle
  button went with the thing it shuffled.
- **A hint's letters had to find a new home.** From hint 2 the mask is an
  anagram, and hiding it from the line would have made a purchased hint reveal
  *nothing*. `buildLetterPool` therefore drains the mask into the pool, spending
  a per-letter budget so it shows no more of a letter than the mask exposes.
  Below hint 2 the mask is positional, so `placedIndices` counts its reveals as
  confirmed and the strip fills them in rather than asking the player to retype
  a letter the board already shows as settled.

Matching changed with it. `checkAnswer` (`lib/letterPool/answerCheck.ts`) is the
one place all three solve paths ask, and once the strip supplies the shape the
comparison is **exact**. That is a correctness fix, not a strictness preference:
the strip fills confirmed letters in, so a fuzzy threshold scores letters the
player never wrote — a seven-letter word with six confirmed reaches 0.857 with
its last letter wrong, and sails past the 0.8 threshold. `normaliseAnswer` folds
case, whitespace and **diacritics**, since the daily game's words are translated
into seven languages and a phone keyboard will often not produce the accents.

### The caret rule is a game-master setting

`caretSkipsGreens` is tunable from `/admin/game-settings` under *How the answer
box takes typing* (key `letter_pool`, seeded by
`20260911120000_seed_letter_pool_settings.sql`). `LETTER_POOL.CARET_SKIPS_GREENS`
in `gameConfig.ts` remains the floor beneath it, so an unapplied migration or an
unreachable table plays exactly as the code does. See
[game_master_guide.md](game_master_guide.md).

It reaches the composer **server-side**, through the daily page, so the board
never renders on one rule and then switches to another. That is also why it is
daily-only: a multiplayer room is a client component, and a fetched setting
would change the caret's behaviour partway through a word.

Whether the pool exists at all stays compiled. It decides what the word line
draws, which `messageFlags`, `CipherText` and `readMaskTile` all read directly,
and a switch that reached the composer but not the bubble would be worse than
no switch.

### Fixes from the first production pass (2026-09-11)

Five defects, found by playing a Hebrew daily word on a phone:

- **The first letter bought at hint 1 vanished from hint 2 up.** The guarantee
  lived only in `buildScrambleItems` — the shuffled view, which this change
  switched off — and nothing else carried it. It is now the first thing
  `readMaskTile` answers under `hideUnplaced`, read from the answer rather than
  the mask so it holds whatever the mask carries, and `placedIndices` agrees so
  the strip does not ask for a letter the player has paid for.
- **A keystroke past the last slot stayed in the DOM.** The model clamped it,
  which produced the string it already held, so React re-rendered nothing, the
  field's sync effect never ran, and the rejected character sat there invisible
  — eating the next Backspace. A controlled field cannot fix this itself, so
  `PlainTextField` takes a `normalize` prop: whatever it strips is rolled back
  out of the DOM, and `onRejected` shakes the strip once, because with the text
  drawn transparent silence reads as a broken keyboard.
- **The pool cropped its own tiles.** `overflow-x: auto` computes `overflow-y`
  to **auto** as well — one axis non-visible forces the other — so the drift and
  the glow were cut off at the top. The track now carries `padding-block` for
  them. The edge fade went with it: it was unconditional, so it dimmed the first
  tile in the common case where nothing scrolled.
- **`font-mono` has no Hebrew.** Pool tiles and slot cells fell back to a system
  font with different metrics, which both clipped tall glyphs under
  `leading-none` and stopped them matching the board. Both now use the app's own
  face at `leading-[1.2]`.
- **A long word ran off the edge instead of wrapping.** Once `--slot-w` is at
  its 18px floor and even that overflows, the word group now wraps. Breaking a
  word across lines is bad; running past the field is worse. The cell ceiling
  also came down from 32px to 26px, which is what a three-letter word needed to
  stop looking like scattered dashes.

### Second production pass (2026-09-11)

- **The palette button is gone.** It existed to state the half of the colour
  rule that said whether a tile's position meant anything — a question the pool
  answers by construction. The key is still reached from How to play, and still
  introduces itself in the bubble the first time a word colours a tile.
  `legend_opened` now only ever reports `source: 'how_to_play'`; see
  [events.md](events.md).
- **Pool tiles animate in.** They did not, and the reason was identity rather
  than animation: `buildLetterPool` keyed a tile as `pool-<index>`, so the next
  word's tiles inherited the previous word's elements — React saw the same keys,
  swapped the characters in place, and nothing ever mounted. The id now carries
  the word, and the arrival is staggered by 50ms a tile so the pool reads as
  filling up rather than blinking into existence.
- **The strip aligns to the start of the field, not its centre.** It sits where
  the text it replaced sat, and the caret opens where the eye already is.
  `justify-start` takes that from `dir`, so it is the right edge in Hebrew and
  Arabic and the left in everything else — which centring could not express
  either way.

### The pool had an order, and the order was the answer's (2026-09-11)

`buildLetterPool` built the pool by walking the answer, so the tiles came out in
**answer order**. Every tile individually claimed nothing about position — which
is the invariant — but a row of them left to right is a sequence, and the pool
had quietly rebuilt the thing it was created to dismantle. A player with the
whole word found could read the remainder off and type it without ever recalling
it.

From hint level 2 it was worse than a leak. The server's mask is an *anagram*
there, deliberately, so that order carries no information; walking `text` to
spend the mask's letter budget sorted that anagram straight back into the answer.
The hint handed over more than it was sold as.

The pool is now returned in a **seeded order that is not the answer's**
(`scramblePool`). Two properties make it safe:

- **Seeded on the whole tile id, which carries the word.** A permutation seeded
  on the index alone is the same permutation for every word of that length, so a
  player who learns it once inverts it forever — the `tiltSeed` mistake again.
- **Stable under insertion.** It is a sort by per-tile key, not a shuffle of the
  array, so a newly found letter takes its place without moving the tiles
  already there. A seeded Fisher-Yates would re-roll the whole pool on every
  reveal and make every tile jump.

`seedFromId` avalanches (FNV-1a plus the murmur3 finaliser) and that half is
load-bearing. Tile ids differ only in their last character, so a plain
accumulate-and-multiply yields `base + n * prime` and the whole permutation
collapses to one cyclic sequence, rotated. Measured: `starling` scrambled to
`gnilrats`, its exact reverse, and two different words drew the identical order.
`poolScramble.test.ts` guards the distribution, not just the fact of a shuffle.

The same seed now drives the tilt, so the drift lost a sawtooth nobody had
noticed: the old hash made angles alternate sign and cycle through four values
in lockstep down the row.

### Saying it without saying it (2026-09-11)

Scrambling silently would only mean the row lies more quietly. A row still reads
as a sequence, and a player who trusts it draws a false lead about how the word
begins. So the arrangement had to say so — and the way *not* to say it is a
"shuffled" badge, because "scrambled" asserts that there is a correct order here
which has been disturbed, and invites the player to unscramble the pool. Outside
the sentence there is no order to recover. The letters are **unordered**, which
is a different claim and a different visual language.

What changed, all of it form rather than chrome:

- **The "Found" heading is gone.** It framed the pool as a headed list, and it
  cost ~40px of a phone's row. `GameRoom.Pool.label` is deleted from all seven
  locales. The accessible name survives on the track's `aria-label`, which now
  states the fact the scatter states visually — a screen-reader user gets none
  of the arrangement, so the words have to carry it there.
- **No shared baseline.** Each tile is lifted by its own seed, within
  `MAX_LIFT_PX` (3) of the band's centre.
- **No even rhythm.** The flex `gap` is gone; the space in front of each tile is
  seeded between 4 and 13px (`--pool-gap`, logical, so it is the right edge in
  Hebrew and Arabic).
- **No boxes.** The dashed, tinted socket made the pool a grid of cells, and a
  grid of cells is a structure with positions in it. What remains is the letter,
  its angle, and a dotted rule under it — which is not decoration but the
  non-hue channel carrying "found, unplaced" for a player who cannot separate
  the orange from the green (WCAG 1.4.1). A placed letter leaves the dimmed rule
  behind as the origin its tile flies back to.
- **One clause of teaching**, in `Legend.pool_note`: "in no particular order".

The dotted rule has to sit **under the glyph**, which means a short tile. At the
old 32px with the letter centred, the rule floated ten pixels below it and read
as a separate tick — and a row of ticks is the grid this change just removed. The
tile is now 24px (20px on a phone) with the glyph bottom-aligned.

The scatter is jitter **inside a fixed band**, never free positioning. A pool
that grew when a letter arrived would move the board under the player's thumb,
which is the constraint `poolMotion.ts` exists to enforce; `.pool-track`'s
`padding-block` went 5px → 8px to cover the lift, since `overflow-x: auto`
computes `overflow-y` to auto and crops anything that leaves the box — which is
how the pool shipped the first time. Net, the band is 2px *shorter* than before:
40px against 42px, and 36px against 38px on a phone. The composer does not grow.

### Reading the keystrokes instead of imposing a shape (2026-09-11)

Skipping confirmed letters was silently modal. A player who typed the answer out
in full — much the commoner instinct — got it shifted by a letter, and on a word
like OOZE the strip filled with `Oooz` and then shook at them. The fix is not to
pick a side but to stop needing one: `resolveTyping` in
[`slotRules.ts`](../src/lib/letterPool/slotRules.ts) reads the keystrokes two
ways at once and lets them rule each other out.

- **gaps** — each character goes to the next *open* slot. Dies by overflowing.
- **whole** — each character goes to the next slot of any kind, so one landing on
  a confirmed letter has to match it. Dies on a disagreement.

The composer never consults the answer to decide — that would be reading the
thing it exists to hide. It looks only at what the player can already see: the
letters it has given them, and how many slots there are. That is enough, because
the two readings fail in different ways.

| Answer | Confirmed | Typed | gaps | whole | Read as |
| :--- | :--- | :--- | :--- | :--- | :--- |
| SAMPLE | `S_m___` | `sample` | overflows | complete | **whole** |
| SAMPLE | `S_m___` | `aple` | complete | dies on `a`≠`S` | **gaps** |
| HARMONY | `HAR_O__` | `harmony` | overflows | complete | **whole** |
| OOZE | `O___` | `ooze` | overflows | complete | **whole** |
| OOZE | `O___` | `oze` | complete | unfinished | **gaps** |

Where both survive, the one that fills every slot wins. Where neither is
finished, *whole* is preferred: the player has matched a letter they were given,
and typing the answer as they would say it is the commoner habit.

**The one rough edge, stated plainly.** A word whose first letter repeats —
OOZE, LLAMA, AARDVARK — is the only shape where neither reading can be ruled out
early, because the first keystroke is consistent with both. Someone who *skips*
on such a word sees *whole*'s arrangement while typing, and the strip settles to
*gaps* on their last keystroke. Preferring *gaps* instead would move that jump
onto every player who types a word out in full, which is far the worse trade.

If neither reading survives — a typo over a confirmed letter — *whole* is shown
with the disagreement marked, because someone who has mistyped is better served
seeing where than seeing nothing.

A confirmed letter that the player merely retypes keeps **the game's** casing
rather than theirs. Otherwise typing LLAMA out in full assembled as `llama`.

### Still to land

`pickLegendSamples` reads the word line for its orange samples and now finds
none there, so the inline key falls back to the generic `B`. It should be
reading the pool. Harmless — the fallback is a path it already had — but the key
is less personal than it was.

---

## Still open

- Tapping anywhere on a hint-2 bubble reshuffles it, not just the shuffle
  button. `shuffled_note` now states the tap outright ("Tap to reshuffle"), so
  the affordance is documented in the one place that is on screen while it
  applies; the button remains the discoverable path, and its tooltip still
  carries the part the note does not — that a shuffle reveals nothing new.
- Under reduced motion, a displaced tile and an ordered one differ only by tilt,
  which is subtle. The word-level rule is still stated in the legend, so the
  information is available, just not per tile.
- `CipherText.test.tsx` drives real timers and takes ~7s for four tests.
