# Database Structure

This document outlines the database schema for the AssociateApp2 project, hosted on Supabase.

## Tables

### 1. profiles
Stores user profile information, linked to the Supabase Auth `users` table.

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | - | Primary Key. References `auth.users.id` |
| `username` | text | - | User's display name |
| `avatar_url` | text | - | URL to user's avatar image |
| `settings` | jsonb | `{"theme": "dark", "language": "en", "audio_volume": 1.0}` | User preferences |
| `updated_at` | timestamptz | `now()` | Last update timestamp |
| `is_admin` | boolean | `false` | Admin status flag |
| `has_seen_onboarding` | boolean | `false` | Has the user seen the onboarding tour? |

### 2. games
Stores information about game instances.

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
Tracks API usage metrics.

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | `gen_random_uuid()` | Primary Key |
| `user_id` | uuid | - | Foreign Key -> `auth.users.id` |
| `game_id` | uuid | - | Foreign Key -> `games.id` |
| `endpoint` | text | - | API endpoint accessed |
| `ip_hash` | text | - | Hashed IP address for rate limiting/tracking |
| `created_at` | timestamptz | `now()` | Access timestamp |

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
