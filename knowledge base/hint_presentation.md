# The hint, as the player meets it

How the hint ladder is *presented*. The rules behind it — when rungs fire, what
they cost, who may change them — live in
[game_master_guide.md](game_master_guide.md) and `src/lib/daily/hintPolicy.ts`;
nothing here changes a single point of scoring.

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
| 2 | `Shuffle` | first letter + 25%, re-scrambled |
| 3 | `MessageSquareQuote` | a written clue |

Under the `jump` progression there are no intermediate rungs to advertise, so no
glyph is drawn at all — unchanged behaviour, `getHintTier` still decides it.

The tooltip reads **benefit, price, what survives**: the rung's label, then
`{cost} pts`, then "Still worth N pts if you solve it" (`valueAfterHint`). It
used to open with the price and close with "Deducted from word value", so both
numbers a hesitating player read were losses.

## How a clue arrives

Every other reveal in this game is a mask coming off. The clue used to simply
appear, in an amber box (`yellow-100` / `yellow-900`, with an `indigo` wait
state) that belonged to no theme and to no other surface in the app.

It now wears the brand accent — `bg-brand-subtle`, a `border-s-2` brand spine, a
soft brand glow — and the text **decodes into place** out of `CIPHER_SIGNS`, the
same alphabet the bubbles are masked with:

- `src/lib/clueDecode.ts` — the arithmetic. `decodeFrame(text, revealed, frame)`
  returns one frame; `decodeStepMs(length)` shares a fixed ~900ms budget across
  the clue so a long one never crawls. Code-point safe: the glyph alphabet
  reaches into the alchemical block, where a sign is a surrogate pair.
- `src/components/game/chat/ClueText.tsx` — the component. Reduced motion is
  settled during render, not by an effect, so it never flashes a masked frame
  first. The animated string is `aria-hidden`; the settled text is the label.
- While a clue is still being fetched, `ClueSkeleton` holds its place with the
  same glyphs, never resolving, beside the word "Decoding". That replaces three
  bouncing dots captioned "Consulting AI".

The hint button's progress ring and the auto-hint countdown badge moved onto the
same brand tokens at the same time; both were spelling purple out by hand.

## The nudge, and why it is quiet now

`useHintNudge` used to jump, rotate and scale the hint button on a loop,
escalating after 15s into a harder jump. That is a control physically demanding
attention from someone who is thinking — the furniture saying "you are stuck",
which is the exact sentence the rest of this feature exists to avoid.

It is one stage now (`idle` → `offered`, after 8s): a slow brand-toned breath
that never escalates. The route out for a player who really is stuck is the
offer bar (`StuckOffer`), which speaks in words, carries the action, and can be
dismissed.

In the daily game the nudge is suppressed whenever the auto-hint clock is
running, which is almost always — so the offer bar is effectively the only thing
that speaks there. That is deliberate, and it is why the bar is the place to
change the game's tone toward a stuck player, not the button.

## What is still open

Three things this pass deliberately did **not** touch, because they change
scoring or the shape of the run and are the game master's call:

1. **The cliff between the clue and the Reveal.** Rung 3 costs 40% of the word;
   after it there is nothing but Reveal at zero and a streak step. A player who
   takes the clue and still cannot see the word gets no further rung.
2. **Whether the ladder should be free in the daily game.** It is a puzzle
   everyone plays once. The whole ladder priced at zero, with hints marked on
   the shared grid instead, is a different game — arguably a friendlier one.
3. **The auto-hint default of 20s per rung.** It is short. It means the daily
   game hands out the ladder whether or not the player wanted it, which makes
   the manual button an accelerator rather than a choice, and makes the nudge
   unreachable.
