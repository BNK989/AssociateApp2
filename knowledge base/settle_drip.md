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

The rule the whole mechanic rests on:

> **The drip gives away positions, never new letters.** Everything it places
> was already visible in the pool.

That is what makes it a *distinct* rung rather than a fourth grade of hint. Hint
level 2 deliberately **destroys** positional information: the mask becomes an
anagram, and `readMaskTile` refuses to promote even a coincidental hit to
`placed`. The drip is the only thing in the game that gives any of it back. It
is the inverse of the hint immediately below it, which is exactly why it belongs
after the ladder rather than inside it.

It also **self-gates** on that rule. With an empty pool there is nothing to
place, so the drip physically cannot fire before the player has been given
something to work with.

---

## The player's experience

1. They go quiet on a word. The hint ladder is spent.
2. The stuck offer says *"Let the letters find their places?"* with a
   **Place them** button.
3. They accept. One letter leaves the halo and its slot in the composer fills
   in, green.
4. Every `intervalMs` after that, another.
5. It stops at the ceiling, with letters still left for them to solve.

They can also decline, and the offer stays declined for that word only.

### A settled letter is a green letter

No fourth tile state. `letter_feedback.md` teaches three, and they are what make
the board readable at all; a fourth meaning "the game put this here" would cost
more than it told anyone. So a settled letter is filled in, skipped by the
caret, gone from the halo, and **indistinguishable on screen** from one the
player earned.

That is a deliberate kindness as well as a simplification. The player is never
shown a running tally of how much help they took.

### How it looks

The chip shrinks away where it hangs in the halo and the slot cell pops at the
same moment — the same *two halves of one event* the composer already tells for
a typed placement (see `poolMotion.ts`, rule 4). There is no directed flight
between the two yet; that is a known follow-up, not a design decision. Under
`prefers-reduced-motion` the letter simply appears.

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
`supabase/migrations/20260913120000_seed_settle_settings.sql`.

| Setting | Default | Notes |
| :--- | :--- | :--- |
| `mode` | `offered` | `offered` \| `auto` \| `off` |
| `armFromHintLevel` | `2` | Below this the rung does not exist |
| `firstDelayMs` | `20000` | `auto` only |
| `intervalMs` | `15000` | The pace the player actually feels |
| `strikeCreditMs` | `12000` | `auto` only; mirrors `STRIKE_WORTH_MS` |
| `maxFraction` | `0.5` | |
| `minUnsettled` | `2` | |
| `order` | `seeded` | |
| `costPerLetter` | `0.05` | |

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
| [`SettleSection.tsx`](../src/components/admin/gameSettings/SettleSection.tsx) | The panel |
| `gameConfig.ts` → `SETTLE` | The compiled floor |

`knownUnplacedIndices` is the seam that matters: the pool and the drip read
**the same function**, so "what is hanging around the word" and "what may be
placed" cannot disagree. A second copy of the mask budget would drift, and the
failure would be the drip placing a letter the player was never shown.

---

## Known gaps

- **No directed flight.** The chip fades where it hangs and the cell pops.
  `useLetterFlights` already measures halo → slot for typed placements, but
  driving it from the drip needs a two-phase commit (announce, fly, then write
  `settled_indices`), which is its own change.
- **No distinct landing cue.** A settled letter animates exactly like a typed
  one. It should read as *the game acting* — slower, with a glow — and does not
  yet.
- **No sound.** The reward-feedback policy has solve and miss tones; a settle
  has none.
- **Client-side only.** `settled_indices` lives on the message and is persisted
  with the localStorage snapshot. Nothing reaches `daily_results`, so all
  analysis is PostHog-side. Adding a column is a migration, and eight are
  already pending.
