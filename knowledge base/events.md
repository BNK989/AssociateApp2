# PostHog Events Documentation

This document outlines the PostHog events tracked in the application, their triggers, and associated properties.

## Events

### 1. `game_created`
Fired when a user successfully creates a new Classic Multiplayer game from the lobby.

- **Trigger**: Client-side, immediately after game insertion in `Lobby.tsx`.
- **Properties**:
    - `game_id`: string (UUID of the created game)
    - `status`: 'texting' (Initial status)
    - `messages_count`: 0 (Initial count)

### 2. `game_status_change`
Fired whenever the game state transitions on the server.

- **Trigger**: Server-side contexts in `src/app/api/game/[id]/action/route.ts`.
- **Properties**:
    - `game_id`: string (UUID of the game)
    - `status`: string (The new status applied)
    - `messages_count`: number (Count of text messages at time of transition)

#### Scenarios:
| Status | Trigger Condition |
| :--- | :--- |
| `solving` | When all active players confirm "Solve Mode" (e.g., via `propose_solve` or `confirm_solve`). |
| `completed` | When a `solve_attempt` results in 0 remaining unsolved words. |
| `texting` | When a game is manually reset via the `reset_game` action. |


### 3. `onboarding_started`
Fired when a new user (who has not seen the tutorial) enters the lobby for the first time.

- **Trigger**: Client-side in `Lobby.tsx`, conditionally on `profile.has_seen_onboarding === false`.
- **Properties**: None (Default PostHog person properties apply).

### 4. `onboarding_completed`
Fired when a user successfully completes the onboarding tutorial.

- **Trigger**: Client-side in `Lobby.tsx` via `handleTutorialComplete`.
- **Properties**: None (Default PostHog person properties apply).

## The daily game's event contract

Every daily-game event is declared in
[src/lib/daily/dailyAnalytics.ts](../src/lib/daily/dailyAnalytics.ts) and
captured through
[useDailyTracking](../src/components/daily/useDailyTracking.ts), which is the
only place in the daily game that talks to PostHog. Nothing captures inline.

That matters because an event is only useful if it can be *broken down*, and a
property present on one event but missing from its sibling cannot be compared
across the two. Building every event through `dailyEvent` guarantees they share
a context, and building the per-word half through `wordContext` guarantees two
events about the same word describe it identically — asserted in
`dailyAnalytics.test.ts` rather than hoped for.

### Context on every daily event

| Property | Meaning |
| :--- | :--- |
| `play_date` | The chain's date, `YYYY-MM-DD`. |
| `date` | The same value. Kept because the original events shipped it under this name and existing insights filter on it. |
| `puzzle_number` | Which puzzle this is, counting the first chain as #1 — the number players see and share. Derived, never passed, so it cannot disagree with the grid. |
| `user_type` | `registered` \| `guest`. |
| `settings_revision` | The `game_settings` revision the game was played under. `0` means the table was unreadable and compiled defaults were used, which is a real answer rather than a missing one. Grouping outcomes by this is how a game-master change is judged. |
| `words_total` | Length of the day's chain. |

### Context on every *word-level* event

`word_index` (position in the chain, the same index the results table uses),
`hint_level`, `strikes`, `other_end_open`, and `ms_on_word` — active time on
the word, taken from the same reading the results table stores, so a PostHog
dashboard and the `daily_results` row can never disagree about one duration.

`other_end_open` is on every word-level event rather than only the one that
opens it, because the question the mechanic has to answer is what happens to
the *rest* of the chain afterwards — solve rate, hints taken, time per word. A
flag that appeared only on the move itself could not be broken down against any
of them.

### 5. `daily_game_entered`
Fired once when a user visits the Daily Game page, after auth resolves so
`user_type` is truthful. It is the denominator of every drop-off rate the daily
game has.

- **Properties**: context only.

### 6. `daily_word_solved`
Fired when a word leaves the board solved.

- **Properties**: word context, plus `word`, `score_gained`, `total_score`,
  `consecutive`.
- The answer itself only ever leaves the client for a word already off the board.

### 6a. `daily_word_revealed`
Fired when the player asks to see a word rather than keep guessing.

Named `revealed`, not `gave_up`: the product no longer frames this as surrender,
and an event name that still did would keep the old framing alive in every
dashboard built on it. The underlying `WordOutcome` is still `gave_up`, since
that is the value written to `daily_results`.

- **Properties**: word context, plus `hints_exhausted` (whether the ladder was
  spent before they reached for it), `total_score`, `consecutive`.

### 6b. `daily_word_struck_out`
Fired when a word runs out of strikes.

- **Properties**: word context, plus `total_score`.

### 6c. `daily_guess_missed`
Fired on every wrong guess, struck out or not.

- **Properties**: word context, plus `band` (`near` \| `off`), `similarity`
  (the raw Levenshtein ratio, to three places) and `strike_forgiven`.
- `similarity` rides along with `band` on purpose: `NEAR_MISS_THRESHOLD` is a
  starting value, and shipping the raw number is what lets it be re-cut from
  what players actually type rather than argued about.

### 6d. `daily_hint_revealed`
Fired whenever a hint lands, however it was triggered.

- **Properties**: word context, plus `source` (`auto` \| `manual`) and
  `to_level`.
- `to_level` is reported rather than inferred: the ladder skips rungs that would
  tell the player nothing, so `hint_level + 1` is wrong exactly on the words
  where the skip matters.
- A level the *policy* hands over before the player has done anything is not an
  event. It shows up as a non-zero `hint_level` on the word's first event.

### 6e. `daily_other_end_opened`
Fired when the player enters the chain from its first word to guess forward.

Its own event rather than a flavour of `daily_word_revealed`. The results table
records it as `gave_up`, because a word was given away and the grid has to say
so — but it is a strategic move, and counting it as a surrender would bury the
one number that says whether the mechanic works.

- **Properties**: word context, plus `words_remaining`.

### 6f. `daily_stuck_offer_shown` / `_reopened` / `_taken` / `_dismissed`
Fired when the game speaks first to a player who has gone quiet on a word, and
when they pull it back open, take it up, or wave it away.

Separate events rather than one with an outcome, because the interesting numbers
are the ratios between them: an offer shown and never taken is the wrong offer,
and one dismissed is an unwanted interruption. `shown` fires once per offer per
word — the offer is re-decided on a timer and would otherwise drown the others.

`reopened` is the one number that says whether collapsing aside beats closing.
An actionable offer steps aside to a chip after nine seconds instead of
disappearing; without this event a chip nobody ever touches looks exactly like
one that was never needed. It can fire more than once per word and is not
deduplicated, since a player opening the same offer twice is itself the signal.

- **Properties**: word context, plus `offer` (`stake` | `other_end` | `letter`
  | `reveal`).

### 7. `daily_game_completed`
Fired when the last word leaves the board — however it left.

Until 2026-09-06 this only fired when the final word was *solved*, so days
ending on a reveal or a third strike were never counted.

- **Properties**: `final_score`, `ended_on` (`solved` \| `gave_up` \|
  `struck_out`), `words_solved`, `outcome_tier` (`perfect` \| `strong` \|
  `partial` \| `blank`), `hints_taken`, `words_revealed`, `opened_other_end`.
- `outcome_tier` is read off the share grid, so the event, the end screen and
  the squares a player pastes into a chat cannot disagree.

### 7a. `daily_chain_revealed`
Fired when the end screen shows the chain and the day's theme.

Separate from completion because the point of the reveal is that *every* tier
gets it, a blank board included — this event is how we check that a player who
solved nothing still saw the payoff.

- **Properties**: `outcome_tier`, `words_solved`.

## Implementation Details
- **Daily game**: never captures directly. Events are declared in
  `src/lib/daily/dailyAnalytics.ts` and captured through `useDailyTracking`,
  which stamps the shared context and swallows an SDK failure into the logger —
  instrumentation must never take a player's game down with it.
- **Client-Side, elsewhere**: `usePostHog()` from `posthog-js/react`.
- **Server-Side**: `getPostHogServer()` singleton from `src/app/posthog-server.ts` and `posthog-node`. Events are flushed immediately using `await posthog.flush()`.


### 8. `legend_intro_shown`
Fired when the colour key opens by itself inside a chat bubble — the first time
a word shows the player a coloured tile, once per device.

- **Trigger**: Client-side in `chat/useLegendIntro.ts`, gated on
  `hasColouredTiles` and the `associ8-legend-intro-seen` key.
- **Properties**:
    - `hint_level`: number (level of the word that triggered it)

### 9. `legend_intro_closed`
Fired when that in-bubble key goes away, whichever way it went.

- **Trigger**: Client-side in `chat/useLegendIntro.ts`.
- **Properties**:
    - `reason`: 'dismissed' | 'guessed' | 'word_settled'

### 10. `legend_opened`
Fired when a player opens the colour key deliberately.

It was added to answer whether the composer's palette button earned the 48px it
held. The answer turned out to be moot: once found letters moved out of the word
line and into the pool, the half of the key that button existed to explain —
whether a tile's position means anything — stopped being a question, and the
button was removed on 2026-09-11. The key is still reached from How to play, and
still introduces itself in the bubble the first time a word colours a tile.

- **Trigger**: Client-side, on open, in `info/HowToPlayDialog.tsx`.
- **Properties**:
    - `source`: 'how_to_play' (the retired button reported 'palette')
    - `hint_level`: number — no longer sent; the dialog is read away from any word


### 11. `app_shared`
Fired when a player passes the game itself on — not a result, but the front
door. The point of counting it is that growth by word of mouth is a product
goal, and a share is the only step of it the app can see.

- **Trigger**: Client-side in `src/hooks/useShareApp.ts`, after the share
  actually goes through (the native sheet resolved, or the link reached the
  clipboard).
- **Properties**:
    - `surface`: 'landing_header' | 'lobby_header' | 'lobby_card' (where the
      player started the share)
    - `method`: 'native' | 'clipboard' (the share sheet, or the fallback used
      where the browser has no Web Share API)

The shared link carries the same surface as a `?ref=` parameter, so arrivals in
`$current_url` join back to the share that produced them. Nothing in the app
reads `ref`; a link stripped of it still works.

### 12. `app_share_dismissed`
Fired when the native share sheet opens and the player closes it without
choosing a target. Kept separate from `app_shared` so the funnel can tell
"never asked" from "asked and declined".

- **Trigger**: Client-side in `src/hooks/useShareApp.ts`, on an `AbortError`
  from `navigator.share`.
- **Properties**:
    - `surface`: 'landing_header' | 'lobby_header' | 'lobby_card'
