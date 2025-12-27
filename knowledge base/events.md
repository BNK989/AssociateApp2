# PostHog Events Documentation

This document outlines the PostHog events tracked in the application, their triggers, and associated properties.

## Events

### 1. `game_created`
Fired when a user successfully creates a new game from the lobby.

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

## Implementation Details
- **Client-Side**: Uses `usePostHog()` hook from `posthog-js/react`.
- **Server-Side**: Uses `getPostHogServer()` singleton from `src/app/posthog-server.ts` and `posthog-node`. Events are flushed immediately using `await posthog.flush()`.
