# AI Logic & Server-Side Functions

The single reference for **every place the app talks to an LLM** and **every piece of
logic that runs on Supabase rather than in the browser**. If you add an AI call, an
Edge Function, a Postgres function, a trigger, or a cron job, it gets an entry here in
the same change (CLAUDE.md §10).

Related: [daily_game_backend_logic.md](daily_game_backend_logic.md) ·
[daily_game_translation_cache.md](daily_game_translation_cache.md) ·
[corn-jobs.md](corn-jobs.md) · [database_structure.md](database_structure.md) ·
[logging_and_debug_mode.md](logging_and_debug_mode.md)

---

## For Product Managers (Non-Technical)

### Which AI does this app use?

**Google Gemini.** That is the only AI provider the running app calls.

There is **no Anthropic / Claude API call anywhere in the product**. Claude is the
coding agent that writes this repo (hence `CLAUDE.md`), and `GEMINI.md` is an
agent-instruction file too — neither is app runtime code. If someone asks "what does
Claude do on Supabase", the answer is: nothing at runtime. The AI that generates
puzzles, hints, and translations is Gemini, called from three places (a nightly
scheduled job, the Daily Game page, and the Classic Game hint button).

### What the AI actually produces

| Player-visible thing | Who makes it | When |
| :--- | :--- | :--- |
| The daily 5–6 word chain and its theme | Gemini, or a curated backup list | Only if nobody pre-planned that day's puzzle |
| The written hints under each word | Gemini, nightly in advance | 1:00 AM UTC, up to 3 days ahead |
| The "how strong is this link" score used for scoring | Gemini, nightly in advance | Same nightly job |
| Hebrew / Arabic / Spanish / French / German / Romanian puzzle text | Gemini, on first request per language per day | Cached 24h, so one player pays the wait |
| The 3rd hint in a Classic multiplayer game | Gemini, live when a player asks | On demand, limited per player |

### What happens when the AI is down

Nothing breaks visibly. Each path has a fallback:

- No puzzle generated → a hand-written backup puzzle is picked (5 in rotation, chosen
  by date so everyone gets the same one).
- No hints generated → the player sees a first-letter hint instead.
- No translation → the player sees the English puzzle with the translated UI around it.
- No Classic hint → the player sees a first-letter placeholder that says AI unavailable.

### Costs and abuse limits

Hint requests are supposed to be capped at 5 per player per game and 100 per IP per
day. **These caps currently do not work** — see the defect box in the technical
section. Nightly pre-generation is the main cost driver and is bounded (max 10 games
per run, max 3 days ahead).

---

## For Developers (Technical)

### 1. Model configuration

Model IDs live in [src/lib/gameConfig.ts](../src/lib/gameConfig.ts):

| Constant | Value | Used by |
| :--- | :--- | :--- |
| `AI_HINT_MODEL` | `gemini-flash-lite-latest` | Daily generator, hint utils, translation, Classic hints, Daily on-demand hints |
| `AI_HINT_BACKUP_MODEL` | `gemini-flash-latest` | Second attempt in the generator and Classic hints |
| `AI_HINT_LIMIT_PER_GAME_PLAYER` | `5` | Rate limit (see defect below) |
| `AI_HINT_LIMIT_PER_IP_DAY` | `100` | Rate limit (see defect below) |

**Two call sites do not read this config** and pin their own model — change them by
hand if you rotate models:

- [supabase/functions/generate-daily-hints/index.ts](../supabase/functions/generate-daily-hints/index.ts)
  has its own local `GAME_CONFIG` with `gemma-3-12b-it`. Edge Functions run on Deno and
  cannot import from `src/`, so the constant is duplicated on purpose.
- [src/app/api/hint/route.ts](../src/app/api/hint/route.ts) hardcodes
  `gemini-1.5-flash` in the URL. This is unintentional drift, not a design choice.

Every call is a plain `fetch` to
`https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=...`.
There is no SDK dependency.

### 2. Every AI call site

| # | Call site | Runs on | Trigger | Produces | Fallback |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | [supabase/functions/generate-daily-hints/index.ts](../supabase/functions/generate-daily-hints/index.ts) | Supabase Edge (Deno) | `pg_cron` 1:00 AM UTC | `hints[]` + `connection_scores[]` for up to 10 upcoming games | Skips the game, retries next night |
| 2 | [src/lib/dailyGameGenerator.ts](../src/lib/dailyGameGenerator.ts) → `fetchAIGeneratedDailyGame` | Next.js server (Vercel) | `/[locale]/daily` when no row exists for today | Whole puzzle: `theme`, `words[]`, `hints[]`, `connection_scores[]` | `getFallbackDailyGame()` — deterministic pick from `FALLBACK_DAILY_GAMES` |
| 3 | [src/lib/dailyHintUtils.ts](../src/lib/dailyHintUtils.ts) → `generateDailyHints` | Next.js server | `/[locale]/daily` when the row exists but `hints` is missing or length-mismatched | `hints[]` + `connectionScores[]`, written back to `daily_games` | `Think about X...` per word |
| 4 | [src/lib/dailyTranslation.ts](../src/lib/dailyTranslation.ts) → `translateDailyGame` | Next.js server | First non-`en` request per (game, locale) per 24h | Translated `theme`, `words[]`, `hints[]` | Returns `null`; page serves English content |
| 5 | [src/app/api/game/[id]/action/route.ts](../src/app/api/game/[id]/action/route.ts) (`action === 'get_hint'`, `nextLevel === 3`) | Next.js API route | Classic player buys the AI hint | One-sentence hint stored in `messages.ai_hint` | First-letter string suffixed `(AI unavailable)` |
| 6 | [src/app/api/daily/hint/route.ts](../src/app/api/daily/hint/route.ts) | Next.js API route | Daily player requests a hint **and** the stored hint is missing | One hint string (not persisted) | `[MOCK] First letter is X` when the key is absent |
| 7 | [src/app/api/hint/route.ts](../src/app/api/hint/route.ts) | Next.js API route | **Legacy.** No caller found in `src/` | One hint string | `[MOCK HINT]` when the key is absent |

> Call site 7 is dead code as far as the app is concerned — nothing in `src/` fetches
> `/api/hint`. It also skips the user check entirely (the file's own comments admit
> this) and pins an old model. Treat it as a deletion candidate, not as a reference.

### 3. Prompt contracts

Three distinct prompts exist, and two of them are **duplicated verbatim** between the
Edge Function and the Next.js server. If you change one, change its twin.

**A. Hint + connection score prompt** — identical text in call sites 1 and 3.
Sends `theme` and the `words` array, demands a JSON array of
`{ word, hint, score }`. The core constraint is the game's direction:

- The array is `[Word 0 … Word N]` but play runs **upwards**: `Word N` is revealed,
  the player guesses `Word N-1` from it, and so on up to `Word 0`.
- Therefore the hint for `Word i` must describe `Word i` **in terms of `Word i+1`**,
  and must never say "the next word" / "the word below" — it has to name the context
  concept naturally.
- `score` is 0.0–1.0 link strength between `Word i` and `Word i+1`, and feeds scoring.

Both parsers are defensive in the same way: strip ``` fences, slice between the first
`[` and last `]`, `JSON.parse`, then **realign by word text** (lowercased, trimmed,
punctuation-stripped) rather than trusting the model's array order. Unmatched words get
a `Think about X...` hint and score `0.5`.

**B. Whole-puzzle prompt** — call site 2. Asks for a JSON *object*
(`theme`, `words`, `hints`, `connection_scores`). Validated before use: theme is a
string, `words.length >= 4`, `hints.length === words.length`. Scores are clamped to
`[0.1, 1.0]`, and default to `0.85` if the array is missing or the wrong length.
It walks four models in order — `AI_HINT_MODEL`, `AI_HINT_BACKUP_MODEL`,
`gemma-4-26b-a4b-it`, `gemini-2.5-flash-lite` — and returns `null` only if all four fail.

**C. Translation prompt** — call site 4. The instruction that matters: translated words
must **preserve the association chain in the target culture**, choosing a culturally
apt synonym over a literal translation when a literal one would break the chain. Hints
are regenerated in the target locale (not translated) and must not contain the target
word or its roots.

**D. Single-hint prompts** — call sites 5, 6, 7. One-liners: short, cryptic, must not
contain the target word. Site 5 caps it at 12 words.

### 4. What runs on Supabase

#### 4a. Edge Functions

| Function | Deployed? | Auth | Secrets | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `generate-daily-hints` | **Yes** (v11, `verify_jwt: false`) | Called with the service-role bearer token by cron | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_KEY` | Nightly hint + score pre-generation |
| `send-feedback` | **Yes** (v5, `verify_jwt: false`) | Public | `RESEND_API_KEY`, `ADMIN_EMAIL` | Emails feedback submissions to the admin via Resend. No AI. |
| `cleanup-games` | **No — local source only** | — | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Archive/delete logic. **Superseded** by the `cleanup_games_logic()` Postgres function, which is what cron actually calls. |

`supabase/functions/cleanup-games/index.ts` exists in the repo but is not deployed to
the project. Do not "fix" it expecting production behaviour to change; edit
`cleanup_games_logic()` instead.

`generate-daily-hints` selection logic: rows in `daily_games` where
`hints IS NULL OR connection_scores IS NULL`, `play_date` between today and today+3,
ordered ascending, `limit 10`. Note this means a game whose hints were written but
whose scores are null gets **both** regenerated.

> The Edge Function logs with raw `console.*` and uses `any` in one spot. That is not a
> CLAUDE.md §1/§8 violation to chase — `src/lib/logger.ts` is a Next.js module and does
> not exist in the Deno runtime. Its `[DEBUG] / [WARN] / [ERROR] / [SUCCESS]` prefixes
> are the Edge equivalent of the logger contract, readable in the Supabase dashboard's
> Edge Function logs.

#### 4b. Postgres functions (`public` schema)

| Function | Returns | `SECURITY DEFINER` | Called by | Purpose |
| :--- | :--- | :---: | :--- | :--- |
| `cleanup_games_logic()` | `text` | yes | cron `daily-cleanup` | Archive games idle >72h, delete archived >7d. Returns `"Archived: X games, Deleted: Y games"`. |
| `delete_expired_guests()` | `void` | yes | cron `delete-guest-users` | Hard-delete anonymous `auth.users` older than 24h; cascades to profiles/messages/game_players. |
| `send_game_message(p_game_id, p_content, p_cipher_length, p_cipher_text, p_potential_value)` | `jsonb` | yes | client `.rpc()` | Atomic message insert + turn rotation. |
| `player_leave_game(p_game_id)` | `jsonb` | yes | client `.rpc()` | Marks `has_left`, reassigns turn if needed. |
| `distribute_game_points(game_id_param, winner_id, winner_amount, author_id, author_amount)` | `void` | yes | client `.rpc()` | Awards solver and author points in one transaction. |
| `increment_score(row_id, game_id_param, amount)` | `void` | no | internal | Bumps `game_players.score`. |
| `increment_team_pot(game_id_param, amount)` | `void` | no | internal | Bumps `games.team_pot`. |
| `handle_new_message()` | `trigger` | no | trigger | See below. |
| `handle_new_user()` | `trigger` | yes | trigger | Creates a `profiles` row for a new auth user. |
| `update_last_activity()` | `trigger` | no | trigger | Touches `games.last_activity_at`. |

#### 4c. Triggers

| Table | Trigger | Timing | Function |
| :--- | :--- | :--- | :--- |
| `public.messages` | `on_message_insert` | BEFORE INSERT | `handle_new_message()` |
| `public.messages` | `on_message_sent` | AFTER INSERT | `update_last_activity()` |
| `auth.users` | `on_auth_user_created` | AFTER INSERT | `handle_new_user()` |

`handle_new_message` ignores system-type messages for turn rotation
(migration `20260101000000_fix_trigger_ignore_system_msg.sql`).

#### 4d. Cron jobs (`pg_cron`)

| Job | Schedule (UTC) | Command | Active |
| :--- | :--- | :--- | :---: |
| `daily-cleanup` | `0 3 * * *` | `SELECT cleanup_games_logic()` | yes |
| `delete-guest-users` | `0 4 * * *` | `SELECT delete_expired_guests()` | yes |
| `generate-daily-hints` | `0 1 * * *` | `net.http_post(...)` to the Edge Function | yes |

Verification queries and manual-trigger recipes live in [corn-jobs.md](corn-jobs.md).

### 5. AI-related tables

| Table | Written by | Notes |
| :--- | :--- | :--- |
| `daily_games` | Call sites 1, 2, 3 | `words` is `text[]`; `hints` and `connection_scores` are `jsonb`. Public SELECT; writes need the service role. |
| `translation_generations` | Call site 4 | Audit trail proving a translation was actually generated (not just cache-served). Columns: `game_id`, `locale`, `generated_at`, `meta`. Surfaced in `/[locale]/admin/translations`. |
| `api_usage` | Call sites 5 and 6 | Intended rate-limit ledger. `endpoint` is `gemini-hint` (Classic) or `daily_hint` (Daily). **Currently always empty — see below.** |
| `messages.ai_hint` | Call site 5 | The generated Classic hint, persisted alongside `hint_level`. |

> ### Known defect: AI hint rate limiting does not work
>
> `api_usage` has **zero rows** in production, so neither the 5-per-player-per-game nor
> the 100-per-IP-per-day cap has ever fired. Two independent causes:
>
> 1. **Classic (`/api/game/[id]/action`)** — the insert includes a `model: modelId`
>    field, but `api_usage` has no `model` column. PostgREST rejects the insert, and
>    the return value is never checked, so it fails silently.
> 2. **Daily (`/api/daily/hint`)** — the route builds its Supabase client with the
>    **anon** key. `api_usage` has RLS enabled and **no policies at all**, so the
>    counts read back as 0 and the insert is rejected. The route also base64-encodes
>    the IP and calls it `ip_hash`, which is encoding, not hashing.
>
> Fixing this needs a migration (add the column or drop the field, plus a
> service-role-only insert path) and a QA pass on both hint buttons. It is documented
> here rather than fixed in the documentation change.

### 6. Secrets

| Variable | Where it must be set | Used by |
| :--- | :--- | :--- |
| `GEMINI_KEY` | Vercel env **and** Supabase Edge Function secrets | All 7 AI call sites |
| `GEMINI_API_KEY` | Vercel env (optional) | Only read as a fallback by call site 5 |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env + Supabase (auto-injected in Edge) | Admin client, Edge Functions, translation audit insert |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env | Server routes and browser client |
| `RESEND_API_KEY`, `ADMIN_EMAIL` | Supabase Edge Function secrets | `send-feedback` |

The Edge Function throws immediately if `GEMINI_KEY` is missing. The Next.js call sites
degrade to their fallbacks instead and log a warning. Setting Supabase secrets is
covered in [setup-secrets.md](setup-secrets.md). Never edit `.env` (CLAUDE.md §12).

### 7. Debugging an AI failure

Logger scopes to grep, per [logging_and_debug_mode.md](logging_and_debug_mode.md):

| Scope | Covers |
| :--- | :--- |
| `daily/generate` | Puzzle generation and the insert-conflict re-fetch |
| `daily/hints` | `generateDailyHints` / `ensureDailyHints` |
| `daily/translate`, `cache` | Translation and cache misses |
| `daily/page` | Server-side load order and fallbacks |
| `api/hint`, `api/daily/hint` | Hint routes |
| `api/game/action` (`get_hint`, `call_model`, `config`) | Classic AI hint, per-model attempts |

Edge Function output is **not** in these scopes — read it in the Supabase dashboard
under Edge Functions → `generate-daily-hints` → Logs, or via
`select * from cron.job_run_details` for the invocation record.

Typical failure signatures:

- *Hints look generic (`Think about A...`)* → the model returned words that didn't
  match the stored words after normalisation. Check the `[WARN] No match found for
  word` lines in the Edge logs.
- *Puzzle is one of the five backups* → `fetchAIGeneratedDailyGame` returned `null`,
  i.e. all four models failed or the key is missing.
- *Non-English player sees English words* → `translateDailyGame` returned `null`; check
  `daily/translate` for the HTTP status.
- *Classic hint says "(AI unavailable)"* → both models in `modelsToTry` failed; the
  `call_model` debug lines carry the status and response preview.
