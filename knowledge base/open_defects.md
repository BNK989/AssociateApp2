# Open defects and open decisions

> **Status: all closed. §1–§4 on 2026-09-13; §5 raised and closed 2026-09-14.**
> Ben answered §1's two open questions with *yes to both* — hints in the daily
> game are free, and the scramble is gone. §5 was the bill for the second
> answer: the "scramble" had not scrambled anything the player saw since
> 2026-09-11, so turning it off took the orange rung out of the ladder and hint 2
> handed over two thirds of the word in place. Reversed the next day. The ladder
> is: length + first letter → loose orange letters → written clue → drip/tap →
> Reveal. See [hint_presentation.md](hint_presentation.md).

Raised from live play on production, 2026-09-13, after the hint-pacing and
tap-to-place changes shipped. Kept here rather than in a session's memory because
the container is ephemeral and these are the next thing to work on.

Ordered by how much they hurt.

---

## 1. The loop feels like asking for hints, not playing — DONE

**Ben, after playing the shipped build:** *"it very much isn't a player 'fun'
game — the player is forced into asking help and help again making them feel
like the game isn't flowing, they're just asking for hints all the time."*

This is the premise, not a defect, and it outranks everything below it.

Turning the auto-hint clock off stopped the game taking hints *for* the player.
It replaced that with the player having to accept offers constantly, and the net
feel got worse. More rungs and more offers were added before the thing that makes
a word hard to hold in your head was fixed at all.

The review's diagnosis stands; the sequencing was wrong. The middle rung of the
ladder still destroys positional information — level 2 turns the mask into an
anagram, and the settle drip exists purely to sell that position back. Every
offer added in front of that is an offer to paper over it.

**Three questions to settle before any more code:**

1. Should the daily ladder be **free**, with hints marked on the share grid
   instead of docked from score? This is already open item 2 in
   [hint_presentation.md](hint_presentation.md) and would remove the entire
   "spending points on help" frame that makes each offer feel like a cost.
2. Should the offer bar speak **far less** — once per word at most?
3. Is the real fix the anagram, not the offers? Making information monotonic
   (change 2 in the review) means a word never gets *harder* to picture, which
   is what "flow" actually requires.

Full review: <https://claude.ai/code/artifact/bec44945-41f7-4d72-9fda-9b7f6bc31331>

---

**Done so far:** the free `place` prompt was removed, because §4 made tapping
cost points and a prompt implying otherwise would have been a lie. Every word is
therefore one offer quieter. That is a real reduction in chatter and it was
forced by §4 rather than chosen, so treat it as a start, not an answer.

**Answered: yes to both.**

1. **The daily ladder is free.** Every hint tier is zero, and so is a settled
   letter. There is no longer any such thing as spending points on help, so an
   offer cannot read as a bill. The share grid still marks the AI clue and still
   does *not* mark the cheap rungs — extending it to every rung would have put
   the punishment straight back in a different currency, which is the opposite
   of the point.
2. **The scramble is gone.** Hint 2 reveals its letters where they belong. The
   ladder now only ever adds to the picture, and the word never gets harder to
   hold halfway through. *Reversed in §5, 2026-09-14: the ladder was already
   monotonic, and "in place" gave the middle of the game away.*

Two consequences worth knowing:

- **The reward grade changed its measure.** It read points-kept, which with a
  free ladder is always the maximum, so every solve graded `clean` and the chime
  stopped distinguishing anything. It reads help-taken now, which is what it was
  always a proxy for.
- **The pool means something different.** It used to fill with letters the
  anagram had scrambled; now it fills with letters your own wrong guesses proved
  are in the word but not where. That is the honest meaning, and it is what makes
  the drip and the tap rare rather than routine. *Also reversed in §5: hint 2
  fills the pool again, and the drip and tap have their work back.*

---

## 2. A letter arriving wipes letters the player already placed — DONE

**Ben:** *"if we already placed a letter and then the orange letter pops into
place (cus of the new hint mechanism) then it just fucks up the already existing
letters, just removes them from the input making the user unclear about what's
going on."*

**Repro:** put some letters into the composer strip, then let a letter settle
into place. The player's own letters vanish from the input.

**Cause to confirm:** `useSlotTyping` clears its typed string whenever the set of
open slots changes, and a settled letter changes exactly that. The keystrokes are
dropped instead of being re-seated around the new green.

The worst of the three defects: the player loses work they did, with no
explanation, at the moment the game was supposed to be helping.

---

**Fixed.** The composer now re-seats the keystrokes around the new letter
instead of clearing them. Exactly one keystroke is dropped — the one that was
sitting in the slot the letter took — and everything else keeps its place.
Under the whole-word reading nothing moves at all. `reseatTyped`, 7 tests.

---

## 3. Placed letters show in the composer but not in the bubble — DONE

**Ben:** *"the shown letters appear in the input but not in the chat bubble —
also very unrefined."*

Confirmed in his screenshot: the strip reads `P U L _ _ Y` with greens while the
bubble above still shows `P` followed by cipher glyphs, none of them filled in.

The two surfaces disagree about the same word. The bubble is what the player
looks at while thinking; the composer is where they type. A confirmed letter has
to read as confirmed in both, or the board is lying in one of them.

[letter_feedback.md](letter_feedback.md) says a settled letter is green "in every
sense the player is asked to learn" — the bubble is not honouring that.

---

**Fixed.** Settled positions are folded into the bubble's green set, so both
surfaces read the same word the same way. No fourth tile state was added:
`letter_feedback.md` already says a settled letter is green in every sense the
player is asked to learn, and the bubble simply was not honouring it.

---

## 4. Decision: what should tapping a loose letter do? — DONE (option B)

**Ben:** *"clicking on the letter just places them as the next character, not as
I thought (place them correctly)."*

Built deliberately as a keystroke at the caret: the pool knows each letter's true
position, so a free tap that dropped it into its own slot would hand over the
answer's shape for nothing — which is what the settle drip charges 5% a letter
for. Ben expected tap to place correctly. So this is a decision to settle, not a
bug to fix.

| | What it does | What it costs |
| :--- | :--- | :--- |
| **A** | Keep the keystroke, make the landing legible so it never looks like the game chose the slot | Nothing, but it keeps surprising people |
| **B** | Tap places correctly **and costs points** — tapping *is* the settle drip with a better gesture | Kills the free rung, collapses two fighting mechanics into one |
| **C** | Tap places correctly and is **free** | The settle drip is then selling what anyone can take for nothing; it would have to go |

**B** is probably the honest answer if tap-to-place-correctly is what Ben wants:
the review already flagged the drip and the scramble as two mechanics working
against each other, and this merges them.

**Decided: B.** Tapping a loose letter now puts it where it belongs and costs
what any settled letter costs. It is the settle drip with a better gesture, not
a second mechanic beside it — the two are one code path now, and a tap refuses
wherever the drip would: past the ceiling, or on a position it would not have
chosen.

The old reasoning for the caret behaviour was sound and beside the point. A tap
that did anything other than the expected thing read as broken rather than as
principled, and "broken" is what it cost us.

---

## 5. The orange letters are gone from the ladder — hint 2 paints green instead — DONE

**Ben, 2026-09-14:** *"the missing orange letters that are part of the game hint
hierarchy. currently when they should appear it seems that green (correctly
placed letters) are appearing thus making the game super easy and not really a
game."*

**Repro:** open today's daily word, take hint 1 (first letter green), take
hint 2. Expected: a handful of orange letters in the halo — letters that are in
the word, positions unknown — and the line still mostly glyphs. Observed: about
two thirds of the line turns green in its true positions and the halo stays
empty. Hint 3 adds the clue and nothing visible in the line. There is no orange
anywhere in the ladder any more.

**Measured on the shipped build**, counting tiles per rung. "Orange in pool" is
zero at every level for every word.

| Word | Letters | Green in line after hint 2 | Left for the player |
| :--- | ---: | ---: | ---: |
| clotheslines | 12 | 8 | 4 |
| starling | 8 | 6 | 2 |
| pulley | 6 | 4 | 2 |
| banana | 6 | 4 | 2 |

Two letters left of a six-letter word, with their positions marked and the
first letter given, is not a puzzle. That is the whole complaint.

### Cause

Commit `c009b53` (2026-09-13, §1 answer 2) set `SCRAMBLE_MASK = false` on the
premise that the level-2 anagram "destroyed positional information — a word
never gets *harder* to picture". That premise was true on 2026-09-10 and false on
the day the flag was flipped.

Since the letter pool landed on 2026-09-11 ([letter_feedback.md](letter_feedback.md),
"Orange left the word line"), the word line has never drawn the anagram. With
the flag on, `readMaskTile(hideUnplaced=true)` glyphs every anagram letter back
out of the line, and `knownUnplacedIndices` puts those same letters in the halo
as orange. The only thing the player ever saw of the "scramble" was: first
letter green in place, the rest of the line still glyphs, and a pool of orange
letters to work with. Nothing was ever displaced. The rung was already
monotonic.

So the flag did not control "scramble the word or not". By the time it was
flipped it controlled "does hint 2 give letters *without* positions, or letters
*with* positions". Turning it off chose the second, and the code did exactly
that: `generateCipherString` returns `positionalMask` for level 2, and
`readMaskTile` and `placedIndices` treat every mask letter as placed. The
one-day regression fixed in `f677b0f` was this same change, half applied.

Three knock-ons follow from the empty pool, and each one was fixed as if it
were its own problem:

- **The drip went silent.** With no orange to place, the settle drip had nothing
  to do, so `3203b96` taught it to *open* unseen letters at the clue level
  (`REVEAL_FROM_HINT_LEVEL`). That is a reveal on a timer, added to fill the
  space where the orange rung used to be. [settle_drip.md](settle_drip.md)
  records it as a consequence of "the scramble going".
- **Tap has nothing to tap.** §4 made tapping a loose letter *the* way to buy a
  position. The pool now only fills from the player's own wrong guesses, so on
  most words there is nothing in it and the gesture is never available.
- **§1's diagnosis was read backwards.** "The drip exists purely to sell that
  position back" was right. The fix was to keep the thing being sold and let the
  drip sell it; instead the thing was given away up front and the drip was
  repurposed.

### Copy that is now wrong

- `messages/en.json` `hint_2`: *"Reveal 1st + 25%"*. The rung reveals
  `ceil(0.66 × letters)` and has since `PERCENT_REVEALED_SHUFFLE_HINT` was set;
  it never matched 25%. Rendered by `inputRules.ts` as the hint button label.
- Tutorial `step3_desc`: *"Orange letters are in the word somewhere."* The
  walkthrough promises a colour the game can no longer produce from hints.
- `step4_desc`: *"word length first, then letters, then a written clue"*. Now
  reads as "then two thirds of the answer".
- `gameConfig.ts` comments around `SCRAMBLE_MASK`, and the "premise" notes at
  the top of the nine test suites that force the flag on, all describe the flag
  as controlling a scramble the player could see.

### Recommended fix, for Ben to confirm

Restore the middle rung as **letters without positions**: hint 2 fills the halo
with `ceil(0.66 × letters)` orange letters and leaves the line as it was after
hint 1. In code that is `SCRAMBLE_MASK = true`, one line. Everything that reads
`maskIsScrambled` already does the right thing on that branch, and the nine
suites that force it on are the specification of that behaviour, so `npm test`
covers it.

This reverses the 2026-09-13 answer, so it is Ben's call. The case for it:

- The ladder stays monotonic. Hint 1 green stays green; hint 2 adds orange;
  the drip and the tap turn orange to green one letter at a time; Reveal
  finishes. Nothing is ever taken away, which was the real goal behind
  "the scramble is gone".
- Hint 3 gets its cliff back on the right side: the clue is the last free
  step, and positions cost a gesture or a wait, as §4 decided.
- The `REVEAL_FROM_HINT_LEVEL` workaround can go back to `null`, since the pool
  is full again and the drip has real work.

If Ben instead wants hint 2 to keep placing letters, the honest version is to
drop the count — 0.66 with positions is a Reveal with a delay — and to delete
the orange promise from the tutorial. Either way the same set of files needs
reconciling in the same change: `gameConfig.ts` comments, the
`SCRAMBLE_MASK` name (rename to something like `HINT_2_WITHHOLDS_POSITIONS`,
since what it toggles is not a scramble of anything the player sees),
[hint_presentation.md](hint_presentation.md) "Hint 2 no longer scrambles",
[settle_drip.md](settle_drip.md), [letter_feedback.md](letter_feedback.md), the
test-suite premise notes, and the `hint_2` / `step3_desc` / `step4_desc` copy in
all seven locales.

---

**Done, 2026-09-14.** Ben: *"yes go ahead and flip it back, do the full
reconciliation. the hint ladder should also include the textual hint which you
didn't write in your recommended fix make sure it isn't missed."* The ladder,
stated in full so the written clue is not lost again:

| Rung | What the player gets | Colour on the board |
| :--- | :--- | :--- |
| 1 | the word's length, and the first letter in its place | one green |
| 2 | `ceil(0.66 × letters)` letters, **no positions** | orange, loose in the halo |
| 3 | the **written AI clue** | nothing new in the line |
| then | settle drip / tap place the loose letters one at a time | orange → green |
| last | Reveal | — |

What changed:

- `HINT_2_WITHHOLDS_POSITIONS = true` (renamed from `SCRAMBLE_MASK`; the
  predicate is `maskWithholdsPositions`). Every reader of the switch already
  did the right thing on this branch, and the nine suites that force it on are
  its specification.
- `SETTLE.REVEAL_FROM_HINT_LEVEL` back to `null`: positions only, never new
  letters. The setting stays for a game master; the two drip suites that relied
  on the clue-level default now turn it on explicitly and assert the shipped
  default is off.
- `hint_2` reads *"Reveal loose letters"* in all seven locales. `step3_desc`
  and `step4_desc` were already right and stand.
- Comments in `gameConfig.ts`, `gameLogic.ts`, `maskTile.ts`, `poolRules.ts`,
  `settleRules.ts`, `settlePolicy.ts` and the ten test premise notes no longer
  describe a scramble the player could see, or a switch that ships off.
- [hint_presentation.md](hint_presentation.md), [settle_drip.md](settle_drip.md),
  [letter_feedback.md](letter_feedback.md) and
  [game_master_guide.md](game_master_guide.md) record the detour and state the
  ladder with the clue as rung 3.
