# Logging & Debug Mode

How diagnostics flow through AssociateApp2, and how the human QA turns them on.

---

## For Product Managers (Non-Technical)

### What players see
**Nothing.** The logging system is completely invisible to players. It never draws
anything on screen, never pops a toast, and never shows a stack trace. A player
who hits a bug sees the normal friendly error message — nothing else changes.

### What it is for
This app is built by an AI agent and tested by a human. When something goes wrong,
the human needs to tell the agent *exactly* what broke. Logs are that shared
language: every diagnostic line names the feature it came from, what it was trying
to do, the relevant IDs (which game, which player, which date), and the underlying
error. The human copies one line out of the browser console, pastes it back, and
the agent knows where to look.

### Turning it on
Verbose diagnostics are **off** for everyone by default. Two ways to enable them:

1. **Settings toggle** — administrators only. Regular players never see this
   control; it does not exist in their Settings screen.
2. **`?debug=1` in the address bar** — add it to any page URL. Works for any
   account on any device, which makes it the practical option for testing on a
   phone. It sticks on that device until turned off with `?debug=0`.

---

## For Developers (Technical)

### The module
[src/lib/logger.ts](../src/lib/logger.ts). Console-only transport. It must never
gain a DOM surface — that constraint is asserted by a test.

```ts
import { createLogger } from '@/lib/logger';

const log = createLogger('daily/generate');

log.info('load_game', 'Loaded pre-planned chain', { play_date: '2026-08-21' });
log.error('persist', 'Insert failed', { play_date: '2026-08-21', locale }, error);
```

Every call takes **operation**, **message**, optional **context** identifiers, and
— for `warn` / `error` — the **original error**. That signature is deliberate: it
makes CLAUDE.md §8's four required pieces impossible to forget.

`createLogger('daily').child('generate')` yields scope `daily/generate`.

### Output format
One line, copy-pasteable:

```
[2026-08-21T09:00:00.000Z] WARN [daily/generate] generate_chain: Gemini returned malformed chain, falling back to curated pool | play_date=2026-08-21 locale=he | SupabaseError(PGRST116): no rows returned — hint: use maybeSingle()
```

Stack traces are appended only while debug mode is on, to keep normal output terse.

### Error normalization
`normalizeError()` understands native `Error` objects **and** Supabase/PostgREST
error shapes, which are plain objects carrying `code` / `details` / `hint` rather
than `Error` instances. Thrown strings, numbers, and circular objects are all
handled without throwing.

### Level gating
| Level | Emitted when |
| :--- | :--- |
| `debug`, `info` | debug mode is ON |
| `warn`, `error` | **always** |

`warn` / `error` stay on in production because console output is not player-facing,
and losing it would blind the QA loop.

### How debug mode resolves
[src/components/settings/DebugModeSync.tsx](../src/components/settings/DebugModeSync.tsx)
runs once per session inside the locale layout and applies, in precedence order:

1. `?debug=1` / `?debug=0` — the QA escape hatch. Persists to `localStorage`
   without touching the profile.
2. An existing `localStorage` flag on this device (key `associate:debug`).
3. `profile.settings.enable_debug_mode`, written by the admin toggle.

Server-side (API routes, server components, edge functions) there is no browser
storage, so debug falls back to `NODE_ENV !== 'production'`.

### The admin toggle
[src/components/settings/DebugSettings.tsx](../src/components/settings/DebugSettings.tsx),
rendered inside [Settings.tsx](../src/components/Settings.tsx). Returns `null`
unless `useAdmin()` reports `is_admin`, so it is absent from the DOM entirely for
players. Writes `settings.enable_debug_mode` on the `profiles` row.

### Testing
[src/lib/logger.test.ts](../src/lib/logger.test.ts) — 18 tests covering error
normalization, line formatting, level gating, debug-mode precedence, scope
nesting, and the no-DOM guarantee. Inject a transport with `setLogSink()` rather
than spying on `console`.

### Enforcement
`no-console` is wired in [eslint.config.mjs](../eslint.config.mjs), currently at
`warn` while ~140 pre-existing `console.*` call sites are migrated. `logger.ts`
itself is exempt — it is the sanctioned transport. Raise to `error` once the
backlog is cleared.

### Migration status
The logger is **new and not yet adopted** across the codebase. New and touched
code should use it; the existing `console.*` calls are tracked in CLAUDE.md's
Known Debt section and get converted opportunistically.
