# The hint, as the player meets it

How the hint ladder is *presented*. The rules behind it — when rungs fire, what
they cost, who may change them — live in
[game_master_guide.md](game_master_guide.md) and `src/lib/daily/hintPolicy.ts`;
nothing here changes a single point of scoring.


## The settle rung, at the end of the ladder

Once the ladder is spent the composer's help button is no longer the eye. While
the settle drip has a letter left to give it draws the **settle button**
instead — ringed with a countdown to the next letter — and the reveal moves into
its long-press menu until the letters run out. How many letters remain is said
by the offer bar and the button's `aria-label`; it was a badge on the button
until 2026-09-13, when it turned out to read as a stopped clock.

> hint → hint → hint → **letter, letter, letter** → reveal

`HintControls` owns that choice, and it is the only place that makes it. Full
reasoning, pacing and game-master controls: [settle_drip.md](settle_drip.md).


## The rule this surface is held to

`stuckSignals.ts` states it for the offer bar and it now governs the whole
feature:

> **The game offers, the player never asks.** A hint you request is an
> admission; the same hint arriving as an offer you accept is the game being
> generous. Identical mechanics, opposite feeling.

Two corollaries, both of which the UI got wrong until 2026-09-13:

1. **A player is never told how the help was made.** The third rung was badged
   `AI` on the button, announced itself as "Consulting AI…" while it loaded, and
   was called an "AI Hint" in the tooltip, the info screen, the tutorial and the
   rate-limit toast. That is a fact about the plumbing, and it invites the
   player to discount the help — or to feel the machine solved the word, not
   them. It is a **clue** now, everywhere the player can see. `messages.ai_hint`
   and `generateAiHint` keep their names: the database and the server may say
   where a thing came from.
2. **Nothing in the composer begs.** See the nudge, below.

## The ladder on the button

One 40px control. The bulb is the identity; the glyph under it says which rung
is next, from one icon family, with no words and no locale text:

| Rung | Glyph (lucide) | What it gives |
| :--- | :--- | :--- |
| 1 | `Ruler` | the word's length |
| 2 | `Shuffle` | two thirds of the letters, **loose in the pool** — no positions |
| 3 | `MessageSquareQuote` | a written clue |

The rungs are, in order: the word's length and first letter, then the letters
without their places, then the written clue. After the clue the settle drip and
the tap turn orange to green one letter at a time, and the Reveal ends it.
Level 2 gave its letters *in place* for one day, 2026-09-13 — see *The middle
rung is orange again*, below.

Under the `jump` progression there are no intermediate rungs to advertise, so no
glyph is drawn at all — unchanged behaviour, `getHintTier` still decides it.

The tooltip reads **benefit, price, what survives**: the rung's label, then
`{cost} pts`, then "Still worth N pts if you solve it" (`valueAfterHint`). It
used to open with the price and close with "Deducted from word value", so both
numbers a hesitating player read were losses. **Since hints went free it reads
the label alone** — see below.

## How a clue arrives

Every other reveal in this game is a mask coming off. The clue used to simply
appear, in an amber box (`yellow-100` / `yellow-900`, with an `indigo` wait
state) that belonged to no theme and to no other surface in the app.

It now wears the brand accent — `bg-brand-subtle`, a `border-s-2` brand spine, a
soft brand glow — and the text **decodes into place** out of the same alphabet
the bubbles are masked with:

- `src/lib/clueDecode.ts` — the arithmetic. `splitClue` cuts the clue into
  maskable words and the punctuation between them; `maskWord(word, revealed,
  frame, offset)` returns one frame of one word; `decodeStepMs(length)` shares a
  fixed ~900ms budget across the clue so a long one never crawls. Code-point
  safe throughout: a clue may be Hebrew, Arabic or carry a surrogate pair.
- `src/components/game/chat/ClueText.tsx` — the component. Reduced motion is
  settled during render, not by an effect, so it never flashes a masked frame
  first. The animated string is `aria-hidden`; the settled text is the label.
- While a clue is still being fetched, `ClueSkeleton` holds its place with the
  same glyphs, never resolving, beside the word "Decoding". That replaces three
  bouncing dots captioned "Consulting AI".

### The decode cannot move the text (2026-09-13)

It used to. A cipher glyph is not the width of a letter — measured off the two
fonts the app actually serves, Noto Sans Symbols 2's signs average **0.88em**
against Rubik's lowercase **0.51em** — and the first version masked character
for character, in the flow. So a masked clue ran about **1.7x** the width of the
clue it was hiding. Measured in Chromium at a phone-width bubble, a 62-character
clue opened **three lines tall and finished two**: the panel shed a line
mid-sentence while the player was reading it, and the bubble above it resized to
match.

Two changes, and the second is the one that makes it exact:

1. **The mask is shorter than what it hides.** `maskedLength` spends about three
   glyphs on every five characters, so a masked word is the width of the word
   rather than twice it. The signs come from `CLUE_SIGNS`, the subset of
   `CIPHER_SIGNS` that is actually in the `symbols` block the app loads — the
   other two thirds (alchemical, planetary, math) fall through to whatever the
   device has, at whatever width that font uses, which is why the mask used to
   churn sideways between frames as well.
2. **Every word is laid out at the width of its finished text.** The real word
   is always in the flow, `invisible` while it is masked, and the glyphs are
   painted over it out of flow (`absolute inset-0`). Line breaks, line count and
   panel height are therefore decided once, by the clue, and no frame of the
   decode can change any of them.

Verified in Chromium with the real fonts: across all 63 frames of that clue, not
one of its 12 word boxes moves by a pixel, and a character decoded under the
overlay sits at exactly the position it keeps once the overlay is gone.

The placeholder came down from 22 glyphs to 10 in the same change. At ~0.88em
each, 22 wrapped to two lines in a narrow bubble, so the panel opened tall on
nothing and jumped again when the real clue replaced it.

### The panel opens on a measured height (2026-09-13)

`HintPanel` used to animate itself open with framer's `layout` prop, a
`height: 'auto'` target and a `scale` from 0.95, all at once. `layout` animates a
box by *projecting* it — scaling the element and counter-scaling only children
that opt in — so the clue text squashed for the length of the transition, the
brand border shimmered, and the second height change (placeholder → clue) landed
unanimated because nothing re-ran the reveal.

It measures instead: `useMeasuredHeight` watches the content with a
`ResizeObserver` and the panel animates `height` to that number, through one
ease that carries both the opening and every later change of content height.
Nothing inside is ever transformed. The `pt-2` that separates the clue from the
word moved *inside* the animated box — as an outside margin it was 8px of layout
that appeared the instant the panel mounted — and the extra breathing room the
bubble row takes while a clue is open (`my-2`) is now eased rather than switched
on.

The hint button's progress ring and the auto-hint countdown badge moved onto the
same brand tokens at the same time; both were spelling purple out by hand.

### The bubble widens on a measured width too (2026-09-14)

The panel eased open, but the bubble around it did not: a chat bubble is as
wide as its content, and when the clue joined that content the bubble jumped
to its 70% cap in one frame, with the row's `my-2` and the panel's height the
only things easing. Live play read it as rough.

Same answer, other axis. `MessageBubble` wraps its in-flow content (the cipher,
the inline colour key, the clue panel) in a sizer that animates `width` to the
content's measured width, from `useMeasuredSize` — the hook `useMeasuredHeight`
is now the height half of. The content itself sits at its natural width
(`w-max`) inside the sizer, capped by the row through container-query units
(`70cqw`/`85cqw` less the bubble's padding; the row is the `@container`), so
its wrapping never depends on the sizer and nothing reflows mid-transition —
the wider content is simply revealed, clipped on the inline axis only. Width
and height travel on the same curve (`PANEL_MS`, `PANEL_EASE`, exported from
`HintPanel`), so the panel's opening and the bubble's widening read as one
motion. Reduced motion collapses it to an instant.

The badges that hang off the bubble's edges — connection score, shuffle, the
strike dots, the solve burst — stay direct children of the bubble, outside the
sizer, so they are positioned and painted exactly as before. `useBubbleWidth`
(the letter halo) observes the bubble's border box and now sees the width
arrive over 340ms rather than at once, which it tolerates.

Unmeasured is `auto`: on the server, in jsdom, or before the first layout the
sizer has no width of its own and the bubble renders at full natural width, so
a test sees the same markup it always did.

## The nudge, and why it is quiet now

`useHintNudge` used to jump, rotate and scale the hint button on a loop,
escalating after 15s into a harder jump. That is a control physically demanding
attention from someone who is thinking — the furniture saying "you are stuck",
which is the exact sentence the rest of this feature exists to avoid.

It is one stage now (`idle` → `offered`, after 8s): a slow brand-toned breath
that never escalates. The route out for a player who really is stuck is the
offer bar (`StuckOffer`), which speaks in words, carries the action, and can be
dismissed.

The nudge is suppressed whenever the auto-hint clock is running. That used to
mean "almost always" in the daily game, so the offer bar was effectively the
only thing that spoke there — but the auto-hint clock is **off by default since
2026-09-13**, so in the daily game the nudge now does fire, at 8s, on every
word. It is the quiet half of the pair: the button saying it is there, with the
offer bar two seconds later saying it in words (it was six until 2026-09-14,
when the bar's first offer came forward from 14s to 10s).

Worth a QA eye. Eight seconds is its own wall-clock constant, unrelated to the
offer bar's clock and blind to strikes, so it is the one remaining timer that
nothing else consults — and the one the game master cannot move: the bar's
thresholds are now settings (see [settle_drip.md](settle_drip.md)), the nudge's
is not. If a game master drags the first offer under 8s the bar will speak
before the button breathes, which is harmless but reads oddly. If the pulsing
reads as nagging across eight words, the fix is to drive it from the same
setting rather than to mute it.

## The ladder is free, and the scramble is gone (2026-09-13)

Both were open questions here for months and both were answered the same day,
after live play turned up the complaint they were waiting for: *the player is
forced into asking help and help again, making them feel like the game isn't
flowing.*

**Hints cost nothing.** Every tier in `HINT_COSTS` is zero, and so is a settled
letter. Accepting an offer is no longer a transaction, so it cannot read as an
admission — which is what the feature's own rule asked for and what its pricing
kept contradicting. The constants survive at zero rather than being deleted: the
classic game reads the same table, and a game master re-pricing the ladder
should not need a deploy.

The hint tooltip drops its price and its "still worth N pts" line while the
ladder is free (`hintsAreFree`). Both would have read as a loss of nothing, which
still frames a hint as a transaction.

**The share grid is unchanged, deliberately.** It still marks the AI clue and
still leaves the cheap rungs unmarked. Marking every rung was considered and
rejected: with points gone, the grid is the only currency left, and spending it
on the smallest nudge would put the punishment straight back.

**Hint 2 no longer scrambles — and, it turned out, never had.** `SCRAMBLE_MASK`
was turned off on the reading that level 2 took every position away again and
handed back an anagram: more information, less picture, and the exact moment
players described the word getting away from them. That was true until
2026-09-11. Since the letter pool moved orange out of the word line
([letter_feedback.md](letter_feedback.md)), the line has never drawn the
anagram: the mask's letters are glyphed out of it and pooled as orange, so the
player saw the first letter in place, glyphs, and a halo of loose letters.
Nothing was ever displaced. What the switch actually decided was whether hint 2
gives letters *without* positions or *with* them, and turning it off chose the
second. **Reversed 2026-09-14** — see below.

> **"Everywhere" was not everywhere, for one day.** The switch shipped with two
> call sites still asking the old question as `hintLevel < 2` — `readMaskTile`'s
> `hideUnplaced` branch, which is the only branch the word line uses, and
> `placedIndices`, which is what fills the composer's strip. Both therefore read
> a positional level-2 mask as an anagram: the line replaced each revealed
> letter with a filler glyph, the strip declined to fill it in, and
> `knownUnplacedIndices` — correctly gated on `maskIsScrambled` — did not pool
> it either, because with the scramble off it is not pool material. Disclosed in
> `cipher_text`, reaching nothing on screen. Hint 2 and hint 3 showed exactly
> what hint 1 showed: the first letter and eleven glyphs.
>
> The settle drip's silence was the visible symptom, and it was the drip working
> as designed — `settleCandidates` reads the pool, the pool was empty, so there
> was nothing to offer and no button to offer it with.
>
> Fixed 2026-09-14; both sites now read the switch. The lesson for the next
> switch of this kind is in the suite that now guards it,
> `src/lib/letterPool/positionalReveal.test.ts`: it **reads** the constant
> rather than mocking it, because the nine suites over this surface each force
> it on at module level and so, for that one day, tested only the world the game
> did not ship. All 1275 tests were green throughout.

One thing follows that is easy to miss:

- **The reward grade changed its measure**, from points kept to help taken. With
  a free ladder the ratio is always 1, so every solve graded `clean` and the
  chime stopped saying anything. See `feedbackTiers`.

### The middle rung is orange again (2026-09-14)

Ben, from live play: *"the missing orange letters that are part of the game hint
hierarchy. currently when they should appear it seems that green (correctly
placed letters) are appearing thus making the game super easy and not really a
game."* Measured: two thirds of the line green in place after hint 2, halo
empty, on every word. Two letters left of a six-letter word with their slots
marked is not a puzzle. Full write-up in [open_defects.md](open_defects.md) §5.

The switch is back on and renamed for what it does: `HINT_2_WITHHOLDS_POSITIONS`,
read through `maskWithholdsPositions`. The ladder the player meets is:

1. **Length and first letter**, green in its place.
2. **Two thirds of the letters, loose** — `ceil(0.66 × letters)`, orange in the
   halo, no positions. The line stays as hint 1 left it.
3. **The written clue.** The last free step.
4. Then the settle drip and the tap turn orange to green one letter at a time
   ([settle_drip.md](settle_drip.md)), and the Reveal finishes it.

It is monotonic throughout: nothing is taken away, which was the real goal
behind "the scramble is gone", and it was already true. What the one-day
version cost was the whole middle of the game — positions were given away at
rung 2 instead of sold back by the drip and the tap, so §4 of open_defects'
tap-to-place had nothing to tap and the drip was repurposed to *open* letters
(`REVEAL_FROM_HINT_LEVEL`, now back to `null` by default).

The hint button's rung-2 label had said *"Reveal 1st + 25%"* since before the
pool existed; it never matched the count. It reads *"Reveal loose letters"* in
all seven locales now. The tutorial's promise that orange letters are in the
word somewhere, and its *"word length first, then letters, then a written
clue"*, were right all along and stand.

## What is still open

1. ~~**The cliff between the clue and the Reveal.**~~ **Bridged.** After the
   written clue a player still holds hint 2's loose letters, and the settle drip
   and the tap place them one at a time before the Reveal is the only move left.
   Whether that pacing is right is a game-master question
   ([settle_drip.md](settle_drip.md)), not an open cliff.
3. ~~**The auto-hint default of 20s per rung.**~~ **Closed 2026-09-13.** The
   delay was never the problem; the clock was. `GAME_CONFIG.DEFAULT_AUTO_HINT_ENABLED`
   is now `false`, so the ladder is not handed out at all unless a game master
   or the player asks for it. The 20s figure survives as the delay used *when*
   someone turns the clock back on.

## Nothing priced lands unasked (2026-09-13)

`stuckSignals.ts` has always stated the rule the stuck-player work rests on —
*the game offers, the player never asks* — and `useAutoHint` obeyed neither
half: it took the rung itself and charged full price. On the old defaults a
player who merely thought about a word for a minute reached level 3, lost 60% of
the word, and earned a permanent yellow square on the share grid. Thinking time
was being read as a hint request.

Three changes carry it, and the second two are the ones that make the first
actually reach anybody:

1. **`DEFAULT_AUTO_HINT_ENABLED: false`** in `gameConfig.ts`. With it off,
   `autoRevealDelay` returns null, `revealSchedule` returns null, and
   `useAutoHint` never fires — which also takes the countdown ring off the hint
   button, since `isActive` needs a schedule with a span. Nothing is removed:
   the manual button reaches every rung and the offer bar proposes the same ones
   a few seconds later, for the player to accept.

2. **The info screen stops manufacturing preferences.** `useInfoSettings.save()`
   used to write `auto_hint_enabled` on every close, seeded from the policy when
   nothing was stored — so opening Settings once, ever, pinned that player to
   whatever the default was that day, and `resolveHintPolicy` then rightly
   treated it as a deliberate choice that outranks both the compiled default and
   the game master's policy. The keys are now written only when the player
   actually moves the controls (`settingsPatch` in `resolveInfoSettings.ts`).

   **This does not reach back in time.** Anyone who has opened the info screen
   before today still carries `auto_hint_enabled: true`, and still gets the old
   pacing. Two ways to clear it, both the game master's call: set the policy at
   `/admin/game-settings` with `scope: 'force'`, which overrides stored player
   preferences wholesale; or drop the manufactured key —
   `update public.profiles set settings = settings - 'auto_hint_enabled';` —
   which cannot distinguish a deliberate opt-in from a manufactured one, so it
   resets everybody to the default.

3. **`other_end` moved below the ladder in `stuckSignals.ts`.** Without the
   clock handing out the ladder, `other_end` holding the second offer stranded a
   stuck player: a lateral move shown to someone who had not been offered a
   hint, and one whose dismissal silenced the word. It first got a 50s window
   (`THIRD_OFFER_MS`, since removed), then on 2026-09-14 lost the slot
   altogether: the ladder's rungs come first, and the other end is offered once
   they are spent, ahead of the reveal, so the route is never lost.

## Tap first, assist later (2026-09-13)

The ladder gained a free rung in front of everything priced. Between the first
offer and the second, a player holding loose letters is told so —
`{ kind: 'place' }`, the count of their own chips, no button — instead of the
stake. A player with letters in hand is not stuck, they are mid-thought, and the
first thing said to them should not be an offer to do it for them.

It carries no action because its action is already on screen: the halo chips are
tappable now (see [letter_feedback.md](letter_feedback.md)), and a button would
have to choose a letter and a slot on the player's behalf — the one choice the
free rung exists to leave with them.

It holds the early window only. Past the second offer (`stuckSecondOfferMs`,
20s by default) the priced ladder runs exactly as before, which is what stops
it becoming the blocker `other_end` was.

The settle rung now carries `lettersLeft`, because the badge that used to state
that bound came off the button the same day — see
[settle_drip.md](settle_drip.md).

What this is *not*: a re-pricing. Tiers are still 10/10/40 and the scramble is
still the middle rung. Those change the scoring maths and the shape of a run,
and they need `20260823090000_add_settings_revision_to_daily_results.sql`
applied first or old and new scores silently stop being comparable.

## The admin panel stops saying "scramble" (2026-09-14)

`/admin/game-settings` described rung 2 as *"Pins the first letter and reveals
most of the rest, scrambled"* and named it **Scramble** in the timeline and in
the demo's level chip. Neither has been true since `HINT_2_WITHHOLDS_POSITIONS`
went back on: the word line keeps its glyphs and two thirds of the letters
arrive in the pool, loose and orange, with no positions at all.

The panel also contradicted itself — the *start level* select on the very same
page already read `2 — loose letters`. It now reads **Loose letters**
everywhere: the rung row, the timeline step, the demo chip.

The internals keep the name. `ScrambleView`, `buildScrambleItems`,
`scramblePool` and `generateShuffledView` all describe a pool whose order is
genuinely scrambled, which is accurate; the false claim was only ever the admin
copy's, that positions came with it.
