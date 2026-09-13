# Open defects and open decisions

Raised from live play on production, 2026-09-13, after the hint-pacing and
tap-to-place changes shipped. Kept here rather than in a session's memory because
the container is ephemeral and these are the next thing to work on.

Ordered by how much they hurt.

---

## 1. The loop feels like asking for hints, not playing

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

## 2. A letter arriving wipes letters the player already placed

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

## 3. Placed letters show in the composer but not in the bubble

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

## 4. Decision: what should tapping a loose letter do?

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

Possibly moot depending on how §1 is settled — do that first.
