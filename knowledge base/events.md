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

### 5. `daily_game_entered`
Fired when a user visits the Daily Game page.

- **Trigger**: Client-side in `DailyGameClient.tsx` on mount (once auth is resolved).
- **Properties**:
    - `user_type`: 'registered' | 'guest'
    - `date`: string (The date of the daily game, e.g., '2023-10-27')

### 6. `daily_word_solved`
Fired when a user successfully solves a word in the Daily Game.

- **Trigger**: Client-side in `DailyGameClient.tsx` inside `handleSolve`.
- **Properties**:
    - `word`: string (The solved word)
    - `score_gained`: number
    - `total_score`: number (Cumulative score)
    - `consecutive`: number (Streak count)
    - `user_type`: 'registered' | 'guest'
    - `date`: string

### 7. `daily_game_completed`
Fired when the last word leaves the board in the Daily Game — however it left.

- **Trigger**: Client-side in `DailyGameClient.tsx` when remaining words is 0.
  Until 2026-09-06 this only fired when the final word was *solved*, so days
  ending on a give-up or a third strike were never counted.
- **Properties**:
    - `final_score`: number
    - `total_words`: number
    - `ended_on`: 'solved' | 'gave_up' | 'struck_out' (how the chain ended)
    - `user_type`: 'registered' | 'guest'
    - `date`: string

## Implementation Details
- **Client-Side**: Uses `usePostHog()` hook from `posthog-js/react`.
- **Server-Side**: Uses `getPostHogServer()` singleton from `src/app/posthog-server.ts` and `posthog-node`. Events are flushed immediately using `await posthog.flush()`.


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
Fired when a player opens the colour key deliberately. The point of counting it
is the composer's palette button: it holds 48px of the input row for the whole
of solving, and this event says whether players actually reach for it or only
ever meet the key when it introduces itself.

- **Trigger**: Client-side, on open, in `input/LegendButton.tsx` and
  `info/HowToPlayDialog.tsx`.
- **Properties**:
    - `source`: 'palette' | 'how_to_play'
    - `hint_level`: number (palette only — the dialog is read away from any word)
