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
    - **Pre-Planned**: If a row exists, it loads directly. This is now the normal
      case — puzzles are prepared a week ahead by the pre-generation cron (§6).
    - **Lazy Fallback (`src/lib/dailyGameGenerator.ts`)**: If no row exists, the
      server generates one on the spot and saves it, so every player that day
      shares the same chain. This is a safety net, not the main path.
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

## 5. How a Puzzle Is Chosen (`src/lib/daily/`)

Puzzles used to be generated from the date and nothing else, and the model's
own preferences decided the subject. That does not work: asked repeatedly for a
word-association chain, it returns the same neighbourhoods. On **2026-08-20 and
2026-08-21 it produced the same theme two days running**, sharing three words.

The subject is now decided before the model is asked anything.

### The wheel (`themeWheel.ts`)

Each date deterministically draws a **domain** (20 subjects) and an **angle**
(7 approaches) from shuffled cycles. Properties the tests enforce:

- every domain is used exactly once per cycle, so none is starved;
- a domain cannot return for at least **5 days** — a plain cycle guarantees no
  repeat *within* a cycle but says nothing about the seam between two, which is
  exactly where a consecutive repeat comes from;
- no domain is pinned to one weekday, so a subject is not always easy or always
  hard.

Everything is a pure function of the date, so a given day always plans the same
puzzle and the whole module is testable without a network.

### The weekday ramp

| | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Words | 6 | 7 | 8 | 9 | 10 | 12 | 8 |
| Min mean connection | 0.82 | 0.80 | 0.76 | 0.72 | 0.68 | 0.60 | 0.78 |

Length and link-tightness move together across the week; Sunday breaks the ramp
deliberately so the week does not simply end. Verified end to end — the seven
puzzles generated on 2026-08-22 came out at exactly 8/6/7/8/9/10/12.

### The prompt (`generationPrompt.ts`)

Two decisions are load-bearing and easy to undo by accident:

1. **No worked example.** The old prompt showed
   `["Sun","Morning","Coffee","Bean","Stalk"]` and the model kept returning that
   chain's neighbourhood. A format example made of real words is a suggestion.
   The shape is described with placeholders instead. A test asserts those words
   never appear in a generated prompt.
2. **Everyday vocabulary only.** Difficulty must live in the *links*, not the
   dictionary. Without this rule the model reaches for specialist registers as
   soon as a harder day is requested — an early run produced a mining chain
   opening on "Headframe" and closing on "Slag". Those are not hard
   associations, they are unfamiliar words, and no amount of clever linking lets
   a player reason toward a word they have never met.

The last 60 days of themes and 30 days of words are passed as explicit
exclusions.

### Validation and retry (`chainValidation.ts`)

The model is agreeable rather than reliable, so its output is checked before it
is accepted. A chain is rejected if it repeats one of its own words, reuses
recent vocabulary, echoes a recent theme (compared on significant tokens, so
"Symphony of Sound" and "A Symphony of Sounds" collide), misses the weekday
length by more than one, carries a hint containing its own answer or pointing at
the list ("the next word"), or has a mean connection outside the day's band.

**Rejection reasons are fed back into the retry prompt**, so a second attempt is
a correction rather than another roll of the dice. Two attempts per model across
four models, then the curated fallback.

Observed working in production on 2026-08-22: the first attempt for 2026-08-24
repeated "Kiln" and returned the wrong number of connection scores; both reasons
went back to the model and the retry was clean.

### Fallback (`fallbackPool.ts`)

One hand-written chain **per domain**, so a fallback day still honours the wheel
instead of collapsing to the same handful. The old pool held five entries — one
of which was the coffee-and-morning chain the model already gravitated to.

Fallback chains carry no hints on purpose: the fallback fires when the model is
unreachable, which is when hint generation would fail too. The existing hint
pipeline fills them on its next run.

## 6. Pre-Generation (`/api/daily/pregenerate`)

Generation used to be lazy — the first player to open `/daily` created that
day's chain. That meant no puzzle could be reviewed before going live, a day
with no visitors produced no row at all (**2026-08-18 and 19 are simply
missing**), and the first player of the day waited on the model.

The route fills any missing date in `[today, today+7]`, capped at **3 dates per
run** so a cold start cannot exhaust the function timeout. In steady state only
one date is ever missing.

Authorised with the service-role key, matching the `generate-daily-hints` job.
It must run **before** the hint cron, so the hint job finds rows to work on.

```sql
select cron.schedule(
    'pregenerate-daily-games',
    '30 0 * * *',
    $$
    select net.http_post(
        url:='https://<your-vercel-domain>/api/daily/pregenerate',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer <service-role-key>"}'::jsonb
    );
    $$
);
```

## 7. The Hint Ladder

A word can be nudged three times, each costing more of its value:

| Level | Reveal | Cost |
| ---: | :--- | ---: |
| 1 | First letter | 10% |
| 2 | Scramble — first letter pinned, 66% of the rest revealed but shuffled | +10% |
| 3 | AI clue, on top of the level-2 scramble | +40% |

`GAME_CONFIG.DEFAULT_AUTO_HINT_REVEAL_TYPE` decides whether the ladder is
climbed or skipped. Only `"ALL"` is special-cased (skip straight to the AI
clue); any other value, including the default `"STEP"`, climbs one level at a
time.

### Why the default is `STEP`

It was `"ALL"` with a 7-second timer, and that combination gave the answer away
before the player had engaged with the word. Three things went wrong at once:

1. **The automatic hint went straight to level 3.** Seven seconds after a word
   became active, the AI clue appeared. Every word in a test session recorded
   `hint_level: 3`.
2. **So did the manual hint button.** `revealHint` passes no reveal type, so it
   took the same default. There was no way to ask for a *small* hint — one tap
   spent the whole ladder.
3. **The button under-reported the price.** `getHintTier` costs the next hint
   from `effectiveLevel` (10% at level 0), while `getNextHintLevel` jumped to
   level 3 and `calculateSolvePoints` deducted the full 60%. The player was
   charged six times what the button offered.

With `STEP` and a 20-second timer, a stuck player now gets the first letter at
20s, the scramble at 40s, and the clue at 60s — and the cost shown is the cost
charged. The manual button is always there for anyone who wants a nudge sooner,
which is why the timer can afford to be patient.

> This also un-saturates `daily_results.hints_used` (§4). While every word
> recorded level 3, that column carried no information about difficulty.

## 8. Feature Flags (PostHog)

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
