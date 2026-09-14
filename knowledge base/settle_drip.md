# The settle drip: letters walking into place

The rung between the last hint and giving up. Found letters — the ones hanging
around the word with no place yet — walk into their real positions one at a
time, so a player who is stuck can still finish the word themselves rather than
revealing it.

---

## Why it exists

The hint ladder ends at the AI clue. Before this, a player who had the anagram
*and* the clue and still could not see the word had exactly one move left:
**reveal it, for zero points**. That is a cliff, and it is the moment the whole
stuck-player effort was aimed at — everything else built for it (kinder
aftermath, a fairer grid, the stuck offers) is passive, and none of it reaches
someone sitting on a word deciding whether to close the tab.

The drip turns that binary into a ramp. A word heading for a reveal instead gets
one letter, then another, and somewhere in there the player usually gets it —
and a solve, however assisted, is a completely different experience from a
surrender.

### It is not a cheaper hint

The rule the mechanic was built on:

> **The drip gives away positions, never new letters.** Everything it places
> was already visible in the pool.

That is what made it a *distinct* rung rather than a fourth grade of hint. Hint
level 2 used to **destroy** positional information: the mask became an anagram,
and `readMaskTile` refused to promote even a coincidental hit to `placed`. The
drip was the only thing in the game that gave any of it back — the inverse of
the hint immediately below it, which is exactly why it belongs after the ladder
rather than inside it.

It also **self-gated** on that rule: with an empty pool there was nothing to
place, so the drip could not fire before the player had been given something to
work with.

### The one day hint 2 gave positions away (2026-09-13 → 14)

The self-gate stopped being a safety property and became the whole story. For
one day the level-2 switch shipped off (`SCRAMBLE_MASK = false`, now
`HINT_2_WITHHOLDS_POSITIONS`), so hint 2 painted its letters green in place and
put nothing in the pool. The pool then held only what the player's own wrong
guesses proved — on a word they had not guessed at, nothing — and at the clue,
where the drip is supposed to be the last rung before giving up, it had nothing
to give. No candidates, therefore no offer, no button, and the ladder fell from
the clue straight to the **Reveal**. Reported from live play as *"why no
floating letters at this stage? should be auto given but i don't even get a
button"*.

The repair on the day was to attach a level to the rule, `revealFromHintLevel`:

> **Below it, unchanged: positions only, out of the pool, nothing new. At and
> above it the drip may also *open* a letter the player has not seen.**

**The switch went back on the next day** — see
[open_defects.md](open_defects.md) §5 and
[hint_presentation.md](hint_presentation.md) *The middle rung is orange again*.
Hint 2 fills the pool with two thirds of the word as loose orange letters, the
ladder runs length + first letter → loose letters → written clue → drip and
tap → Reveal, and the founding rule above holds again without help: the drip
has a full pool to place from and never needs to open anything.

`revealFromHintLevel` therefore ships **`null`** and stays as a game-master
control. Three things keep it from becoming a fourth hint if someone turns it
on:

- **Set it to the clue level**, so the ladder is spent before it applies. A drip
  that opens letters earlier is a shortcut past the hints.
- **The pool is spent first.** A loose letter costs the player only its
  position, so every one of them goes before anything new is opened.
- **Both ceilings still bind** — at most half the word, never the last two
  letters, never the first one (hint 1 bought that).

---

## Where it sits in the hint flow

**This is the part that makes the mechanic reach anyone.** The composer has
always replaced the hint button with the eye the moment the ladder ran out — so
the one permanent control in front of a stuck player said *give up*, and the
drip was only ever offered transiently, in a bar that appeared after half a
minute of silence and could be dismissed. A player who waved that away, or never
waited long enough to see it, met the old cliff exactly as before.

The ladder now runs all the way down in the composer itself:

> hint → hint → hint → **letter, letter, letter** → reveal

`HintControls` owns that one decision. At max hints it draws the
**settle button** while the drip has anything left, and the reveal only once it
does not. The reveal has not gone anywhere — it is in the long-press menu, where
it already was — it is simply no longer the *first* thing offered to someone who
is stuck, and it comes back as the button the moment the letters run out.

Tapping the settle button takes a letter immediately, which is the same move the
hint button makes against its own countdown: a clock the player can always
pre-empt. It is also how a player who never saw the stuck offer starts the drip
at all.

---

## The player's experience

1. They go quiet on a word. The hint ladder is spent. The composer's help button
   becomes the settle button. How many letters it can still place is said by
   the offer bar and by the button's `aria-label`, not by a badge — see below.
2. Either the stuck offer speaks — *"Let the letters find their places?"* — or
   they tap the button themselves. One rung earlier, at hint level 2 with the
   letters loose, the offer is a fork instead: *"Grab one"*, two buttons,
   *Show clue* and *Place letters*, each quoting its price when `showPrices`
   is on. The title is two words on purpose — the buttons carry the sentence,
   and a longer prompt (it used to spell out both forks) read as a paragraph
   to get past rather than a hand to take. It used to open *"Stuck?"*, and
   lost the word the same day: naming the state to a player who is in it is
   not encouragement. Picking the clue shows the clue; picking the letters
   starts the drip. Neither closes the other — it is an order, not a trade.
3. A letter lifts out of the halo, flies to its slot in the composer, and lands
   green.
4. The ring around the button fills. When it is full, another letter flies.
5. It stops at the ceiling, the count reaches zero, and the button gives way to
   the reveal — with letters still left for them to solve.

They can decline the offer, and it stays declined for that word only. The button
remains either way.

---

## The two animations, and why they are not decoration

### The letter has to be seen to travel

Without the flight, the chip vanishes from the halo and, separately, a green
letter appears in the composer — two events about 200px apart, in two different
scroll contexts, with nothing linking them. Three things break:

- **Provenance.** The player has to *infer* that those are the same letter. But
  identity is the entire informational payload here: the drip gives away
  position, not letters, and "*this* letter you already had belongs *there*" is
  the whole sentence. Leaving the subject of that sentence to inference gives
  away the value of the rung.
- **Agency.** An unprompted change that simply appears reads as a glitch or a
  state reset. Motion with a source and a destination reads as an *actor*. That
  is the difference between "the board changed" and "the game gave me
  something", and the second one is what makes an offered hint feel generous
  rather than remedial.
- **Attention.** The player is looking at the word bubble, where they are
  thinking — not at the composer. A letter that appears silently in the strip
  can be missed outright: they spent points on it and never saw it. The flight
  drags the gaze from the bubble to the strip, which is also where they need to
  be looking to type the rest.

### The wait has to be visible

Without a countdown, a letter every fifteen seconds is indistinguishable from
randomness. The player cannot form a model, so they cannot rely on it:

- **Unpredictable help is not felt as help.** The reason to stay on the word is
  that *something is arriving*. A player who does not know that has no reason.
- **It converts dead time into anticipation.** Fifteen seconds of nothing is
  fifteen seconds to consider closing the tab; fifteen seconds of a visibly
  filling ring is fifteen seconds of "wait for it". Same interval, opposite
  feeling — and that is the entire psychological mechanism the rung exists to
  exploit. `AutoHintBadge` already makes exactly this argument about the
  auto-hint clock.
- **It bounds the promise.** "Place them" does not say how many or how fast. The
  ring says when; the count says how many are left. The game must not imply that
  letters keep coming, because the allowance stops well short of the answer.
- **It marks the end honestly.** When the count reaches zero the button becomes
  the reveal, and the player watched that coming instead of discovering it when
  the letters silently stopped.

> **The badge came off the button on 2026-09-13.** A bare number in a circle on
> a game screen reads as a clock, and this one never moved, so it read as a
> broken one — the first thing it was asked about in QA was why it was not
> counting down. Everything above still holds; the count simply says its piece
> in words instead, in the settle offer (`settle_title` carries `{count}`) and
> in the button's own `aria-label`. What is lost is the at-a-glance bound, which
> was never legible enough to be worth the misreading.

**The ring fills; it does not drain.** `HintProgressRing` drains, because that
clock counts down to a hint that will cost points — running out. This one brings
a letter. Filling is what says *arriving* rather than *expiring*, and the
direction is the message. It is also drawn in `--tile-present`, the orange of a
found-but-unplaced letter, which is precisely what it is counting down to
placing.

### A settled letter is a green letter

No fourth tile state. `letter_feedback.md` teaches three, and they are what make
the board readable at all; a fourth meaning "the game put this here" would cost
more than it told anyone. So a settled letter is filled in, skipped by the
caret, gone from the halo, and **indistinguishable on screen** from one the
player earned.

That is a deliberate kindness as well as a simplification. The player is never
shown a running tally of how much help they took.

### How the flight works

Settling is **two-phase**, and the phases are not ceremony — they are what makes
the animation possible at all. The moment a letter is written into
`settled_indices` it counts as placed, which takes it out of the pool, which
unmounts its halo chip; and a chip that has unmounted has no rectangle to fly
from.

So the letter is *announced* first and *written* second:

1. `useSettlePlacement` sets `pendingIndex`. Nothing is written.
2. `useSlotTyping` keeps that letter in the pool and binds it to the slot it is
   heading for — which is exactly the state a letter the **player typed** is in.
3. `useLetterFlights` sees a pool id arrive in a slot and launches, with no idea
   the game rather than the player put it there. No new animation code.
4. The flight lands, `onLanded` fires, and the letter is written.

Everything else reads an announced letter as not settled yet, so the ceiling,
the candidate list, the score and the analytics all count it once — at the
moment it arrives, never the moment it set off. **A flight that never lands
therefore costs the player nothing.**

A 700ms backstop commits anyway if no flight ever runs or finishes:
`prefers-reduced-motion`, a chip or cell that could not be measured, or a scroll
mid-flight, which lands every flight at once on purpose. It is comfortably past
`MAX_MS` in `flightPath`, so it never pre-empts a real landing.

---

## The rules

All in [`src/lib/daily/settleRules.ts`](../src/lib/daily/settleRules.ts), pure
and tested, with no clock anywhere near them. The hook owns *when*; everything
about *what* is there.

### The ceiling — two independent floors

```
allowance = min( floor(typeable × maxFraction), typeable − minUnsettled )
```

Neither subsumes the other, and both are needed:

| Word | Letters | `maxFraction: 0.5` alone | With `minUnsettled: 2` |
| :--- | ---: | ---: | ---: |
| `CONSTELLATION` | 13 | 6 | 6 |
| `STARLING` | 8 | 4 | 4 |
| `OPAL` | 4 | 2 | 2 |
| `OAK` | 3 | 1 | **1** |
| `OX` | 2 | 1 | **0** |

The fraction scales with the word; the absolute floor is what stops the drip
finishing a short one. Counted against **typeable** length, so the spaces and
apostrophes the strip supplies for free never inflate the allowance.

The drip can also stop early — only letters already in the pool may be placed,
so a word with little found runs out of candidates before it reaches the cap.
That is why `allowance` rides along on every settle event: without it, "ran out
of candidates" and "hit the ceiling" look identical in the data.

### Which letter goes next

| `order` | What it does | When to use it |
| :--- | :--- | :--- |
| `seeded` *(default)* | A fixed shuffle, deterministic per word | Spreads the constraint, so each letter is worth less and the ceiling goes further |
| `left-to-right` | The first unsettled letter | Strongest clue per letter — word openings carry the most information — and therefore the fastest way to spend the allowance |
| `rare-first` | The least common letter first | Maximum deduction per letter: a settled Q narrows the answer far more than a settled E, for the same cost |

`seeded` keys off the **answer**, not the index — the trap `scramblePool`
documents at length. A permutation seeded on position alone is the same
permutation for every word of that length, and a player who learns it once can
invert it forever.

Non-Latin answers all rank equal under `rare-first`, which degrades it to the
seeded order rather than to text order. Deliberate: text order is the one
arrangement that must never leak.

---

## The clock

[`useDailySettle`](../src/components/daily/useDailySettle.ts) owns *when* and
nothing else.

**It runs on the stuck clock's terms, not a fifth parallel timer.** The daily
game already has four systems firing on dwell time (the auto-hint ladder, the
start level, the stuck offers, the hint nudge). In `offered` mode the drip's
clock does not run at all until the player accepts, so the stuck ladder's own
escalation is the only thing deciding when they are asked.

**The count owed is derived from elapsed time, not counted up tick by tick.**

```
offered:  1 + floor(elapsed / intervalMs)      // acceptance is the first
auto:     settlesDueBy(dwell + strikes × strikeCreditMs)
```

That is what makes it survive a backgrounded tab, a re-mount and a restored
save: all three converge on the same answer instead of drifting apart. Letters
are still placed **one per tick** even when several are owed, so a player
returning to a long-backgrounded tab watches them arrive rather than finding the
work already done.

### Two bugs the tests caught, worth not reintroducing

- **Acceptance leaked onto the next word.** With the clock reset in an effect,
  the commit that swapped the word still ran the drip's effect with the previous
  word's acceptance, and placed a letter on a word the player had only just
  reached. The clock is now tagged with its word and reset **during render**, so
  no effect ever observes the stale one. `useSlotTyping` clears keystrokes the
  same way.
- **Accepting handed over two letters.** The placement count was derived from
  `settled_indices`, which arrives a commit later via `patchTarget` — so the
  drip could not see its own last placement and immediately made another. It now
  counts its own placements in a ref, and the effect reaches the placer through
  a ref too, so the drip is driven by the clock and by nothing else.

---

## Scoring

Each settled letter costs `costPerLetter` of the word's base value, deducted
alongside the hint tiers in `calculateSolvePoints`.

The written clue costs `clueCost` of the base value, charged once on reaching
hint level 3 **by any route** — the header button, the level-2 choice, or the
auto-hint — with the same start-level exemption the tiers use: a game that
*opens* at the clue is not charged for it unless `chargeForStartLevel` is on.
It is kept small (5% shipped) on purpose: the fork it prices is there to keep
a stuck player playing, and a price that stings would argue for closing the
tab. The header's tooltip and the level-2 offer both quote it from the same
`choicePrices`, so the number the player reads is the number the scoreboard
takes. Zero is a valid setting and hides the quote.

**There is a floor, and it is load-bearing rather than defensive.** A settled
solve has to stay strictly better than the reveal it replaced, which scores
**zero** — otherwise the rung built to stop players giving up would, at the far
end of its own cost curve, make giving up the rational move. Three hint tiers
plus a handful of settled letters crosses zero on plausible settings, so
`SETTLE.MIN_SCORE_FRACTION` is reachable, not theoretical.

---

## Game-master controls

`/admin/game-settings` → *Letters walking into place*. Key `settle` in
`game_settings`; migration
`supabase/migrations/20260913120000_seed_settle_settings.sql`, **applied to
production 2026-09-13** at revision 1 with an empty value. The panel saves.

| Setting | Default | Notes |
| :--- | :--- | :--- |
| `mode` | `offered` | `offered` \| `auto` \| `off` |
| `armFromHintLevel` | `2` | Below this the rung does not exist |
| `revealFromHintLevel` | `null` | Pool only. Set to `3` and from the clue it may also open unseen letters |
| `firstDelayMs` | `20000` | `auto` only |
| `intervalMs` | `15000` | The pace the player actually feels |
| `strikeCreditMs` | `12000` | `auto` only; the drip's own clock, not the offer's |
| `maxFraction` | `0.5` | |
| `minUnsettled` | `2` | |
| `order` | `seeded` | |
| `costPerLetter` | `0.05` | |
| `clueCost` | `0.05` | Price of the written clue, by any route; not tied to `mode` |
| `showPrices` | `true` | Whether the level-2 choice quotes each fork's price |
| `stuckFirstOfferMs` | `10000` | Quiet before the stuck offer says anything. Every mode, `off` included |
| `stuckSecondOfferMs` | `20000` | Quiet before it escalates from a reason to a route. Never stored below the first; equal skips the reason |
| `stuckStrikeWorthMs` | `8000` | What a wrong guess is worth on the offer's clock. Under the first offer so one miss does not summon the bar |

The three `stuck*` rows are the bar's clock, not the drip's, and sit at the top
of the panel under **When the game speaks up**. They live on this row because
the offer is how the drip is reached and the `settle` policy already travels to
the board (`useDailyStuckOffer` → `useStuckOffer` → `stuckOffer`'s `timing`).
Added 2026-09-14, when the bar's 14s / 30s / 12s were hard-coded in
`stuckSignals.ts` and a game master asked where to change them.

**`offered` is the default, and it is the one setting with a real argument
behind it.** It is the rule the rest of the stuck machinery already follows: *a
hint you request is an admission; the same hint arriving as an offer you accept
is the game being generous.* Identical mechanics, opposite feeling. `auto` is
the other arm of that question and is what the analytics below exist to settle.

The row is seeded **empty**, like every other key, so it falls back per field to
`SETTLE` in `gameConfig.ts` and cannot drift from the code. Note the compiled
default is `offered`, so **the rung exists whether or not the migration is
applied** — the migration buys the ability to tune it without a deploy, not the
feature. A fallback of `off` would have made the whole mechanic silently
conditional on a migration nobody remembered to run.

There is no scope. A player who wants no help declines the offer, which is the
entire point of offering rather than imposing.

---

## What to measure

The one question: **does the drip convert would-be give-ups into solves, and at
which letter?**

### `daily_letter_settled`

One per letter. `settle_ordinal`, `slot_index`, `allowance`, `letters_total`,
`source` (`auto` | `offered`), plus the shared word context.

### `letters_settled`, on every word event

This is the load-bearing one. It rides on the **shared** `WordContext`, so it is
present on `daily_word_solved`, `daily_word_revealed`, `daily_word_struck_out`,
`daily_guess_missed`, `daily_hint_revealed` and the offer events alike.

That is not tidiness. `P(solve | n settled)` is a *ratio between two events*,
and a property present on one and missing from the other cannot be broken down
across them — the exact divergence `dailyAnalytics.ts` exists to prevent.

### `ms_since_last_settle`, on `daily_word_solved`

The causal signal, and nearly free. A letter landing shortly before a solve is
evidence the letter *caused* it; a solve minutes later is a player who got there
on their own. `letters_settled` alone cannot tell those apart — it counts
letters that may have done nothing.

### `letters_settled_total`, on `daily_game_completed`

### The four things to actually look at

1. **Conversion curve** — `P(solve | n settled)` for n = 0, 1, 2, 3. The shape
   sets `maxFraction`. If it flattens between 2 and 3, ship 2.
2. **Cannibalisation** — reveal rate and strike-out rate by `settings_revision`.
   The mechanic fails if it only makes existing solves cheaper.
3. **Attribution** — the `ms_since_last_settle` distribution. Bimodal with a
   sub-2s spike means the drip is doing the work.
4. **Score integrity** — mean score per solve by `letters_settled`. A settled
   solve should sit between an unaided solve and a reveal.

The offer itself is measured through the existing
`daily_stuck_offer_shown/taken/dismissed` family with `offer: "settle"`, rather
than a parallel set — cross-offer comparison is the entire reason that family
exists.

---

## Where the code is

| File | Owns |
| :--- | :--- |
| [`settleRules.ts`](../src/lib/daily/settleRules.ts) | Which letter, how many, when to stop. Pure |
| [`settlePolicy.ts`](../src/lib/daily/settlePolicy.ts) | The stored policy and its total parser |
| [`useDailySettle.ts`](../src/components/daily/useDailySettle.ts) | The clock, and nothing else |
| [`stuckSignals.ts`](../src/lib/daily/stuckSignals.ts) | Where the rung sits in the ladder |
| [`poolRules.ts`](../src/lib/letterPool/poolRules.ts) | `placedIndices` / `knownUnplacedIndices` — settled counts as placed |
| [`useSettlePlacement.ts`](../src/components/daily/useSettlePlacement.ts) | The two-phase write, so the letter can be seen to fly |
| [`HintControls.tsx`](../src/components/game/input/HintControls.tsx) | Which control stands in the composer's help slot |
| [`SettleButton.tsx`](../src/components/game/input/SettleButton.tsx) | The button and its ring; the count is in its `aria-label` |
| [`SettleSection.tsx`](../src/components/admin/gameSettings/SettleSection.tsx) | The panel |
| `gameConfig.ts` → `SETTLE` | The compiled floor |

`knownUnplacedIndices` is the seam that matters: the pool and the drip read
**the same function**, so "what is hanging around the word" and "what may be
placed" cannot disagree. A second copy of the mask budget would drift, and the
failure would be the drip placing a letter the player was never shown.

The letters the drip *opens* are derived by subtraction from that same seam —
`unseenIndices` takes everything that is neither in `placedIndices` nor in
`knownUnplacedIndices` — for the same reason and with the same failure mode
reversed: re-reading the mask there could disagree with the board, and the drip
would "open" a letter already in plain sight.

An opened letter was never loose, so it has no halo chip to fly from.
`withAnnounced` lends it one for the length of its flight, which is why the
two-phase write in `useSettlePlacement` still works unchanged: the composer
cannot tell an opened letter from a found one, and neither can the animation.

---

## Known gaps

- **A settled letter animates exactly like a typed one.** Same flight, same
  spring. It arguably should read as *the game acting* rather than as a
  keystroke — slower, with a glow on the cell. Left alone deliberately for now:
  the shared motion is what makes the gesture legible at all (the player has
  already learned what that flight means), and differentiating it is a tuning
  question better answered after a QA pass than guessed at.
- **No sound.** The reward-feedback policy has solve and miss tones; a settle
  has none.
- **Client-side only.** `settled_indices` lives on the message and is persisted
  with the localStorage snapshot. Nothing reaches `daily_results`, so all
  analysis is PostHog-side. Adding a column is a migration, and eight are
  already pending.
