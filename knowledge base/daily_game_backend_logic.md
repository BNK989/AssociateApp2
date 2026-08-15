# Daily Game Backend Logic

This document details the technical implementation of the Daily Game mode in AssociateApp2, specifically focusing on data loading, game state management, and the role of backend services.

## 1. How the Game Loads

The Daily Game is unique compared to Classic Mode because it is primarily a **Client-Side** experience initialized with server-side data.

### Loading Flow (`src/app/daily/page.tsx`)
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
*   **words**: A JSONB array of strings (e.g., `["Coffee", "Morning", "Sun"]`).
*   **play_date**: The specific date this chain is for.

## 2. Game State & Messages

**"Does it load it into messages?"**
**No.** The Daily Game does **not** create rows in the backend `messages` table for the game session.

### Client-Side Message Generation (`src/app/daily/DailyGameClient.tsx`)
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
*   **Logic**: Checks for upcoming games (next 2 days) that are missing hints and uses Google Gemini to generate and save them.

#### Retrieval (`src/app/api/daily/hint/route.ts`)
The API route now primarily acts as a gatekeeper:

1.  **Authentication**: The route validates that the request comes from a logged-in User (Guest users are blocked).
2.  **Verification**: It re-fetches the `daily_games` data to ensure the client is asking for a valid word index.
3.  **Rate Limiting**: Checks the `api_usage` table to enforce:
    *   **Per Player Limit**: Max 5 hints per game.
    *   **Per IP Limit**: Max 100 hints per day (global safety).
4.  **Gemini Integation**: 
    *   **Primary**: Hints are pre-loaded in the `daily_games` table. The server simply returns the stored hint.
    *   **Fallback**: If hints are missing (cron failed), the client (via `page.tsx`) or server may trigger on-demand generation (legacy behavior retained for robustness).
5.  **Logging**: The usage is recorded in `api_usage`.

## 4. Feature Flags (PostHog)

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
