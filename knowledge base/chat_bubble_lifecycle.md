# Chat Bubble Lifecycle

A word in the chain is not one thing. It passes through three stages, and the
bubble's job — and therefore how loud it is allowed to be — changes at each.
This is the rule the chat list is designed around.

| Stage | The bubble's job | What it may carry |
| :--- | :--- | :--- |
| `upcoming` | Promise that the chain continues | The cipher, nothing else |
| `active` | Be the workspace for the word being solved | Cipher, shuffle, guess dots, the AI clue open |
| `settled` | Be a record: the word and its outcome | The word, an outcome mark and spine, the clue collapsed |

## Technical flow

The stage is derived in
[`deriveMessageFlags`](../src/components/game/chat/messageFlags.ts) and returned
as `stage`, alongside two things computed from it:

- `hintDisplay` — `'none' | 'open' | 'collapsed'`, consumed by
  [`HintPanel`](../src/components/game/chat/HintPanel.tsx).
- `isDimmed` — true only for an `upcoming` word while the game is in `solving`.

`MessageBubble` reads all three and does nothing else with the lifecycle; the
decisions are in the pure module so they are testable, and
`messageFlags.test.ts` covers every stage and every hint case.

```
isTarget            → active
else isVisible      → settled       (solved, lost, revealed by an admin)
else                → upcoming
```

`isVisible` already folds in solved, given-up, third-strike and admin-revealed,
so "settled" needs no extra concept.

### Why the clue is withheld on an upcoming word

The `every-word` start reach in the hint policy seeds the entire chain at its
entitled level when the board is built, clue text included. Before this the
bubble rendered the clue whenever `hint_level === 3`, so under that setting a
player scrolling ahead read a paragraph describing each word they had not
reached yet. `hintDisplay` returns `'none'` there.

This is display only. The clue stays on the message, so entitlement, the
`hint_level` written into the daily result, and scoring are all untouched — a
word charged for a start-level hint is still charged for it.

Outside `solving` there is no active word to look ahead of, so nothing is
withheld and a classic texting-mode bubble renders exactly as before.

### Why the clue collapses instead of disappearing

Once the word is revealed the clue is spent: the answer sits directly above it.
Kept open it cost roughly 90px of high-contrast amber per settled word, and a
chain of four solved words pushed the one word still in play towards the edge
of the viewport. Collapsed it is a single muted `Hint used` row that opens on
tap — which also makes it the only place mid-game where a player can see which
words cost them a hint.

## Logical / user flow

Scrolling the board during solving, the player sees one bright word with a
moving border, a run of settled words behind it marked with a green or grey
spine down their leading edge, and anything not yet reached held back at 60%
opacity (returning to full on hover, so it is recessed rather than hidden).

Only the active word is clickable. The bubble used to take
`cursor-pointer` and an indigo hover ring whenever it reserved bottom padding —
including on solved words, where the padding is there for the outcome mark and
tapping does nothing. That affordance now follows `canShuffle`, which is the
thing the click actually does.

## Deliberately not done

- **Collapsing the settled bubble further** (to a one-line "word ✓" row). It
  would compress the history hard, but the revealed word at full size is the
  reward for solving it, and shrinking it immediately undercuts that.
- **Hiding upcoming words entirely.** The chain's length is information the
  player is entitled to; only the clue text is lookahead.
- **A per-word points chip on the settled bubble.** The end-of-game results
  screen already itemises this, and duplicating it in the scroll re-inflates
  exactly the vertical budget this change reclaimed.
