# Daily Game Backend Logic

This document details the technical implementation of the Daily Game mode in AssociateApp2, specifically focusing on data loading, game state management, and the role of backend services.

> For the AI side of this flow - which model runs where, the exact prompts, the
> parsing and fallback rules, and every function running on Supabase - see
> [ai_and_server_functions.md](ai_and_server_functions.md).

## 1. How the Game Loads

The Daily Game is unique compared to Classic Mode because it is primarily a **Client-Side** experience initialized with server-side data.

### Loading Flow (`src/app/[locale]/daily/page.tsx`)
1.  **Server Component Execution**: When a user navigates to `/daily`, the request is handled by a Next.js Server Component.
2.  **Date & Time**: The server determines the current date (UTC/Server time).
3.  **Database Query & Dynamic Fallback**: The server queries the Supabase `daily_games` table:
    ```sql
    select * from daily_games where play_date = 'YYYY-MM-DD'
    ```
    - **Pre-Planned**: If a row exists, it loads directly.
    - **Dynamic AI Fallback (`src/lib/dailyGameGenerator.ts`)**: If no entry exists for today's date, the server dynamically invokes Google Gemini AI to generate a themed word chain (5–6 words), hints, and connection scores. The generated game is immediately saved into `daily_games` for `play_date = YYYY-MM-DD` so all players share the same daily game on that day. If AI is unreachable, a deterministic curated fallback pool is used.
4.  **Data Injection**: The fetched game data (specifically the `words` array, `theme`, and `date`) is passed as props to the client-side component `DailyGameClient`.

### The `daily_games` Table
The daily game content is pre-determined and stored in the `daily_games` table.
*   **words**: A `text[]` array of strings (e.g., `["Coffee", "Morning", "Sun"]`).
*   **play_date**: The specific date this chain is for.

## 2. Game State & Messages

**"Does it load it into messages?"**
**No.** The Daily Game does **not** create rows in the backend `messages` table for the game session.

### Client-Side Message Generation (`src/app/[locale]/daily/DailyGameClient.tsx`)
*   **Initialization**: Upon mounting, the `DailyGameClient` takes the `words` array prop and **generates** the message objects in-memory within the browser.
*   **Mock Data**: It assigns a mock `id`, `user_id` ('daily-bot'), and timestamps to these messages to mimic the structure of a real game.
*   **Local Persistence**: The game state (current score, consecutive streak, revealed messages) is saved to the user's **LocalStorage** (`daily_game_state_YYYY-MM-DD`). This allows the user to refresh the page and resume their daily game without needing a backend database write.

### Comparison with Classic Mode
*   **Classic Mode**: Reads/Writes to the `messages` table in Supabase in real-time. Every turn is a database transaction.
*   **Daily Mode**: Only Reads from `daily_games` at intervals. Gameplay updates are local.

## 3. Backend Services & API Routes

While the core loop is client-side, specific features utilize backend API routes.

### AI Hints
The "3rd Hint" (AI Hint) is generated in advance by a scheduled background job, but the client still requests validation from the server before revealing it.

#### Generation (Cron Job)
*   **Schedule**: Runs daily at 1:00 AM UTC via `pg_cron`.
*   **Function**: Invokes the `generate-daily-hints` Edge Function.
*   **Logic**: Checks upcoming games (today through today+3, batch of 10) that are missing
    `hints` **or** `connection_scores`, and uses Google Gemini to generate and save both.

#### Retrieval (`src/app/api/daily/hint/route.ts`)
The API route now primarily acts as a gatekeeper:

1.  **Authentication**: The route validates that the request comes from a logged-in User (Guest users are blocked).
2.  **Verification**: It re-fetches the `daily_games` data to ensure the client is asking for a valid word index.
3.  **Rate Limiting**: Checks the `api_usage` table to enforce:
    *   **Per Player Limit**: Max 5 hints per game.
    *   **Per IP Limit**: Max 100 hints per day (global safety).
    *   > **Broken today.** The route uses the anon key against an RLS-enabled
      > `api_usage` with no policies, so the counts always read 0 and the usage insert
      > is silently rejected. Neither limit fires. See
      > [ai_and_server_functions.md](ai_and_server_functions.md#5-ai-related-tables).
4.  **Gemini Integation**: 
    *   **Primary**: Hints are pre-loaded in the `daily_games` table. The server simply returns the stored hint.
    *   **Fallback**: If hints are missing (cron failed), the client (via `page.tsx`) or server may trigger on-demand generation (legacy behavior retained for robustness).
5.  **Logging**: The usage is recorded in `api_usage`.

## 4. Results & Measurement (`daily_results`)

Gameplay is client-side, but the **outcome** is now recorded server-side. This
table exists to answer two questions that gate the daily game's length: how long
a chain actually takes, and at which word players give up.

### Why it is written progressively

The row is upserted after **every resolved word**, not only on completion. A
player who quits at word 8 of 12 never reaches a completion event, and that
abandonment is the signal we most need. The last stored state for a
`(client_id, play_date)` is therefore how far that player got, and
`per_word.length` across all rows for a date is the drop-off histogram.

A row is also opened the moment the board goes live, with an empty `per_word`.
Those rows are players who arrived and solved nothing — the denominator every
drop-off rate is measured against.

### Identity: why `client_id` and not just `user_id`

Guests in this app are **not** anonymous auth users — there are none. A guest
simply has no session, so `auth.uid()` identifies only the registered minority.
Keying on that alone would bias every number toward signed-in players.

`client_id` is a UUID minted into `localStorage` (`associ8-client-id`) for every
player. `user_id` is attached as an attribute when a session exists. The unique
key is `(client_id, play_date)`; a signed-in player on two devices produces two
rows, so streak queries aggregate on `coalesce(user_id::text, client_id)`.

### Columns

| Column | Note |
| :--- | :--- |
| `client_id` | Per-browser UUID. Present for everyone. |
| `user_id` | Set when signed in, null for guests. |
| `words_total` | Full chain length, **including** the free revealed start word. |
| `words_solved` | Outcome `solved` only; excludes gave-up and struck-out. |
| `duration_ms` | Sum of per-word active time. |
| `per_word` | `[{ index, outcome, hint_level, strikes, points, ms }]` |

`outcome` is `solved` | `gave_up` | `struck_out`.

> **Reading `per_word` against `words_total`:** the last word of the chain is
> revealed for free and is never guessed, so a completed game has
> `per_word.length === words_total - 1`. Do not treat the shortfall as a
> drop-off.

### Timing is attention, not wall clock

Each word's `ms` stops while the tab is hidden, and is capped at 10 minutes
(`MAX_WORD_MS`). The cap catches the player who leaves the tab focused and walks
away — counting that would drag every median we compute.

### Writes are server-only

`daily_results` has RLS enabled with a SELECT policy for a player's own rows and
**no INSERT or UPDATE policy at all**. The anon key that ships in the browser
bundle cannot write to it. `/api/daily/result` writes through the service-role
client, following the posture set in
[database_security.md](database_security.md).

The route enforces what it can of an inherently client-scored game:

- `play_date` must be within a day of today (UTC), so old dates cannot be backfilled.
- `words_total` comes from the stored chain, **not** the request — a client cannot
  claim a longer game than the one served, nor index past its end.
- Every field is range-checked (`parseResultPayload` in `src/lib/daily/dailyResults.ts`,
  shared with the client that builds the payload).
- **Progress may not regress.** Without this, reopening a finished game would let
  the fresh empty log overwrite the completed one, and a second tab would do the
  same mid-game.

A failed write is logged and swallowed. The daily game has never depended on the
server and still does not — the player sees nothing.

### Known gap

Striking out on the **final** unsolved word does not set `gameOver`
(`useDailyGame.solve` patches the message but never re-checks the remaining
count). Those players never record `completed = true`, so completion rates read
slightly low. Pre-existing, tracked separately.

---

## 5. Feature Flags (PostHog)

The Daily Game uses **PostHog** feature flags to control rollout strategies and game difficulty adjustments without redeploying code.

### `dailygame-auto-hint-level`
Controls the initial difficulty of the game by automatically revealing hints for the active word.

*   **Key**: `dailygame-auto-hint-level`
*   **Payload**: `{ "initialHintCount": number }` (0-3)

#### Levels:
*   **Level 0 (Default)**: Standard game. No auto-hints.
*   **Level 1**: **First Letter** of the active word is revealed.
*   **Level 2**: **Scramble Mode**. First letter is pinned (from L1), and 70% of the remaining letters are revealed but scrambled.
*   **Level 3**: **AI Hint**. Includes Level 2 scramble + an automatic AI text hint.

> **Note**: The game prioritizes local `localStorage` state. If a user has already started a game, changing the flag will not affect them until the next day (or if they clear storage).
