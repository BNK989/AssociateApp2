# Database Structure

This document outlines the database schema for the AssociateApp2 project, hosted on Supabase.
Stored procedures, triggers, cron jobs and Edge Functions are documented separately in
[ai_and_server_functions.md](ai_and_server_functions.md).

## Tables

### 1. profiles
Stores user profile information, linked to the Supabase Auth `users` table.

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | - | Primary Key. References `auth.users.id` |
| `username` | text | - | User's display name |
| `avatar_url` | text | - | URL to user's avatar image |
| `settings` | jsonb | `{"theme": "system", "language": "en", "audio_volume": 1.0}` | User preferences |
| `updated_at` | timestamptz | `now()` | Last update timestamp |
| `is_admin` | boolean | `false` | Admin status flag |
| `has_seen_onboarding` | boolean | `false` | Has the user seen the onboarding tour? |

### 2. games
Stores information about game instances (Classic Mode).

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | `uuid_generate_v4()` | Primary Key |
| `handle` | integer | `nextval('games_friendly_id_seq')` | User-friendly numeric ID for the game |
| `status` | text | `'texting'` | Game status (e.g., 'lobby', 'texting', 'active', 'solving', 'completed', 'archived') |
| `mode` | text | `'free'` | Game mode (e.g., 'free', '100_text') |
| `current_turn_user_id` | uuid | - | ID of the user whose turn it is |
| `created_at` | timestamptz | `now()` | Game creation timestamp |
| `last_activity_at` | timestamptz | `now()` | Timestamp of the last activity in the game |
| `archived_at` | timestamptz | - | Timestamp when the game was archived |
| `solving_proposal_created_at` | timestamptz | - | Timestamp when a solve was proposed |
| `solving_started_at` | timestamptz | - | Timestamp when solving mode started |
| `solve_proposal_confirmations` | text[] | `'{}'` | Array of user IDs who confirmed the solve proposal |
| `team_pot` | integer | `0` | Shared team points/pot |
| `team_consecutive_correct` | integer | `0` | Count of consecutive correct guesses by the team |
| `fever_mode_remaining` | integer | `0` | Counter for fever mode duration |
| `max_messages` | integer | - | Maximum messages allowed in the game |

### 3. game_players
Join table associating users with games (many-to-many relationship).

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `game_id` | uuid | - | Foreign Key -> `games.id` |
| `user_id` | uuid | - | Foreign Key -> `profiles.id` |
| `score` | integer | `0` | Player's score in this game |
| `joined_at` | timestamptz | `now()` | Timestamp when user joined the game |
| `is_archived` | boolean | `false` | Whether the game is archived for this user |
| `has_left` | boolean | `false` | Whether the user has left the game |
| `consecutive_correct_guesses` | integer | `0` | Player's individual streak |

### 4. messages
Stores messages sent within games.

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | `uuid_generate_v4()` | Primary Key |
| `game_id` | uuid | - | Foreign Key -> `games.id` |
| `user_id` | uuid | - | Foreign Key -> `profiles.id` (Author) |
| `content` | text | - | The original message content |
| `cipher_text` | text | - | The encrypted/obfuscated message |
| `cipher_length` | integer | - | Length of the cipher text |
| `type` | text | `'text'` | Message type |
| `is_solved` | boolean | `false` | Whether the message has been solved/decrypted |
| `solved_by` | uuid | - | ID of the user who solved the message |
| `hint_level` | integer | `0` | Current hint level revealed for this message |
| `ai_hint` | text | - | AI-generated hint for the message |
| `strikes` | integer | `0` | Number of failed guess attempts |
| `author_points` | integer | `0` | Points awarded to the author |
| `winner_points` | integer | `0` | Points awarded to the solver |
| `created_at` | timestamptz | `now()` | Message timestamp |

### 5. invites
Stores game invitations sent between users.

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | `uuid_generate_v4()` | Primary Key |
| `game_id` | uuid | - | Foreign Key -> `games.id` |
| `sender_id` | uuid | - | Foreign Key -> `profiles.id` |
| `receiver_id` | uuid | - | Foreign Key -> `profiles.id` |
| `status` | text | `'pending'` | Invite status |
| `created_at` | timestamptz | `now()` | Invite creation timestamp |

### 6. feedback
Stores user feedback submissions.

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | `gen_random_uuid()` | Primary Key |
| `user_id` | uuid | - | Foreign Key -> `auth.users.id` (Optional) |
| `name` | text | - | Submitter's name |
| `email` | text | - | Submitter's email |
| `message` | text | - | Feedback content |
| `feedback_type` | text | - | Type: 'bug', 'feature_request', 'general', 'other' |
| `status` | text | `'new'` | Feedback status |
| `created_at` | timestamptz | `now()` | Submission timestamp |

### 7. api_usage
Intended ledger for AI hint usage, backing the per-player (5 per game) and per-IP
(100 per day) rate limits.

> **This table is currently always empty and the rate limits never fire.** Both writers
> are broken in different ways - see the defect box in
> [ai_and_server_functions.md](ai_and_server_functions.md#5-ai-related-tables).

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | `gen_random_uuid()` | Primary Key |
| `user_id` | uuid | - | Foreign Key -> `auth.users.id` |
| `game_id` | uuid | - | Foreign Key -> `games.id` |
| `endpoint` | text | - | API endpoint accessed |
| `ip_hash` | text | - | Hashed IP address for rate limiting/tracking |
| `created_at` | timestamptz | `now()` | Access timestamp |

### 8. daily_games
Stores the predetermined word chains for the Daily Challenge mode.

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | `gen_random_uuid()` | Primary Key |
| `play_date` | date | - | The date the game is played (YYYY-MM-DD). Unique. |
| `words` | text[] | - | Postgres array of strings containing the word chain |
| `theme` | text | - | A short subject or title for the chain |
| `hints` | jsonb | - | JSON Array of pre-generated AI hints, one per word |
| `connection_scores` | jsonb | - | JSON Array of 0.0-1.0 link strengths, one per word. Feeds scoring. |
| `created_at` | timestamptz | `now()` | Auto-generated timestamp |

`hints` and `connection_scores` are written by the nightly `generate-daily-hints` Edge
Function, or on demand by the Daily Game page if the nightly job missed the row. See
[ai_and_server_functions.md](ai_and_server_functions.md).

### 9. translation_generations
Audit trail proving a Daily Game translation was actually generated by Gemini rather
than served from the Next.js cache. Surfaced in the admin translations page.

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | `gen_random_uuid()` | Primary Key |
| `game_id` | uuid | - | Foreign Key -> `daily_games.id` |
| `locale` | text | - | Target locale the translation was generated for |
| `generated_at` | timestamptz | `now()` | Generation timestamp |
| `meta` | jsonb | `'{}'` | Reserved for future generation metadata |

### 10. daily_results
Per-player outcome of a daily chain — the measurement layer for the daily game.
Written **progressively** by `/api/daily/result` (service role) after every resolved
word, not only on completion, because a player who abandons at word 8 of 12 never
reaches a completion event and that abandonment is the signal. RLS allows a
signed-in player to read their own rows; there is no write policy at all.

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | `gen_random_uuid()` | Primary Key |
| `client_id` | text | - | Stable per-browser id. Present for guests, who have no session |
| `user_id` | uuid | `null` | References `auth.users.id`; null for guests |
| `play_date` | date | - | The chain's date. Unique with `client_id` |
| `words_total` | smallint | - | Chain length, taken from the stored game rather than the request |
| `words_solved` | smallint | `0` | Words actually solved |
| `score` | integer | `0` | Final score |
| `hints_used` | smallint | `0` | Sum of hint levels taken |
| `strikes` | smallint | `0` | Total wrong guesses |
| `duration_ms` | integer | `0` | Active time; tab-hidden excluded, per-word capped |
| `completed` | boolean | `false` | Whether the chain was finished |
| `per_word` | jsonb | `'[]'` | `{index, outcome, hint_level, strikes, points, ms}` per resolved word. Its length is the drop-off histogram |
| `settings_revision` | integer | `null` | `game_settings.revision` in force for this play. `0` = compiled defaults were used; `null` predates the column |
| `created_at` / `updated_at` | timestamptz | `now()` | Timestamps |

### 11. game_settings
Game-master tunables, edited from `/admin/game-settings` without a deploy. One row
per setting key; currently only `daily_hint_policy`. **Readable by anon** — guests
play the daily game, so they must get the same settings as everyone else, which
means **nothing secret may be stored here**. No write policy: writes go through
`/api/admin/game-settings` on the service role after an `is_admin` check.

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `key` | text | - | Primary Key. e.g. `daily_hint_policy` |
| `value` | jsonb | `'{}'` | The policy. Parsed by a total parser that clamps and falls back per field, so a malformed value degrades to the compiled defaults |
| `scope` | text | `'default'` | `default` seeds only players with no stored preference; `force` overrides everyone |
| `revision` | integer | `1` | Bumped on every write and stamped onto `daily_results`, so outcomes can be attributed to a configuration |
| `updated_by` | uuid | `null` | References `auth.users.id` |
| `updated_at` / `created_at` | timestamptz | `now()` | Timestamps |

### 12. game_settings_history
Append-only audit trail of `game_settings` writes — answers "what changed on the
14th, and who changed it" when a metric moves, and backs rollback. Service-role
only: RLS is enabled with no policies.

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | `gen_random_uuid()` | Primary Key |
| `key` | text | - | The setting key written |
| `value` | jsonb | - | The value as stored |
| `scope` | text | - | Scope as stored |
| `revision` | integer | - | The revision this write produced |
| `updated_by` | uuid | `null` | References `auth.users.id` |
| `created_at` | timestamptz | `now()` | When the change was made |

> See [game_master_guide.md](game_master_guide.md) for what these settings do.

## Relationships

- **profiles**
  - `id` references `auth.users.id` (1:1 with Auth User)

- **games**
  - `current_turn_user_id` references `profiles.id` (optional)

- **game_players**
  - `game_id` references `games.id`
  - `user_id` references `profiles.id`

- **messages**
  - `game_id` references `games.id`
  - `user_id` references `profiles.id`

- **invites**
  - `game_id` references `games.id`
  - `sender_id` references `profiles.id`
  - `receiver_id` references `profiles.id`

- **feedback**
  - `user_id` references `auth.users.id`

- **api_usage**
  - `user_id` references `auth.users.id`
  - `game_id` references `games.id`

- **translation_generations**
  - `game_id` references `daily_games.id`
