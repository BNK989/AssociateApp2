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

The nudge is suppressed whenever the auto-hint clock is running. That used to
mean "almost always" in the daily game, so the offer bar was effectively the
only thing that spoke there — but the auto-hint clock is **off by default since
2026-09-13**, so in the daily game the nudge now does fire, at 8s, on every
word. It is the quiet half of the pair: the button saying it is there, with the
offer bar six seconds later saying it in words.

Worth a QA eye. Eight seconds is its own wall-clock constant, unrelated to the
offer bar's 14s and blind to strikes, so it is the one remaining timer that
nothing else consults. If the pulsing reads as nagging across eight words, the
fix is to align it with `FIRST_OFFER_MS` rather than to mute it.

## What is still open

Three things this pass deliberately did **not** touch, because they change
scoring or the shape of the run and are the game master's call:

1. **The cliff between the clue and the Reveal.** Rung 3 costs 40% of the word;
   after it there is nothing but Reveal at zero and a streak step. A player who
   takes the clue and still cannot see the word gets no further rung.
2. **Whether the ladder should be free in the daily game.** It is a puzzle
   everyone plays once. The whole ladder priced at zero, with hints marked on
   the shared grid instead, is a different game — arguably a friendlier one.
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

3. **`THIRD_OFFER_MS` in `stuckSignals.ts`.** Without this, turning the clock
   off strands a stuck player: `other_end` held the escalation slot for as long
   as the chain could still be entered from its far side, and with nothing
   handing out the ladder any more, a player who declined to leave the word
   would be shown the same lateral move forever and never offered a hint. It now
   holds that slot for a 50s window, after which the ladder continues to the
   rungs that address the word in front of them — and reappears below the
   ladder, ahead of the reveal, so the route is never lost.

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

It holds the early window only. Past `SECOND_OFFER_MS` the priced ladder runs
exactly as before, which is what stops it becoming the blocker `other_end` was.

The settle rung now carries `lettersLeft`, because the badge that used to state
that bound came off the button the same day — see
[settle_drip.md](settle_drip.md).

What this is *not*: a re-pricing. Tiers are still 10/10/40 and the scramble is
still the middle rung. Those change the scoring maths and the shape of a run,
and they need `20260823090000_add_settings_revision_to_daily_results.sql`
applied first or old and new scores silently stop being comparable.
