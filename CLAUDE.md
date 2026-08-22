# AssociateApp2 — Project Rules

Canonical engineering standards for this project. These apply to **every** change.
Agent-specific rule files (`.agent/rules/`, `.agents/rules/`) defer to this document.

---

## 1. Language & Typing

- **All source files are TypeScript** — `.ts` / `.tsx` only. No `.js` / `.jsx` in `src/`.
- **No `any`.** `tsconfig.json` already runs `strict: true`; keep it that way.
  - If a type is genuinely unknown, use `unknown` and narrow it.
  - For third-party shapes without types, write a local `interface` or use the
    generated Supabase types rather than reaching for `any`.
  - Escape hatch: if `any` is truly unavoidable, it needs an inline
    `// eslint-disable-next-line @typescript-eslint/no-explicit-any` **with a reason comment**.
- Prefer generated Supabase types (`generate_typescript_types` via the Supabase MCP)
  over hand-written DB shapes.

## 2. File Size

- **Cap: 350 lines per file.** Crossing it is the signal to refactor — extract
  sub-components, custom hooks, or utility modules.
- New files must not be created over the cap.
- **Generated files are exempt** (e.g. `src/types/database.types.ts`). Never
  hand-edit them; regenerate instead.

### Enforced by a ratchet, not by good intentions

`max-lines` is wired as an **error** in [eslint.config.mjs](eslint.config.mjs)
and applies to every file. The `GRANDFATHERED_MAX_LINES` ratchet that carried
the nine pre-cap files is now empty: all nine were refactored under the cap
between 2026-08-21 and 2026-08-22.

Never add an entry to it. A new file lands under the cap or it does not land;
a file that has grown past it needs splitting, not pinning.

> This rule was prose until 2026-08-21 and it drifted: eight of the nine
> grandfathered files grew during the logging migration, +21 lines in total,
> and nothing caught it. Hence the ratchet.

## 3. Icons & Emojis

- **No emojis in UI chrome, component code, or log output.** Use SVG icons —
  [Lucide React](https://lucide.dev/) ships with shadcn/ui and is already a dependency.
- **Exception — game content.** `CIPHER_SIGNS` in [src/lib/gameConfig.ts](src/lib/gameConfig.ts)
  is a deliberate set of alchemical/geometric glyphs used as the cipher masking
  alphabet. These are game mechanics, not decoration, and are exempt.
- Emojis inside translated user-facing *copy* (`messages/*.json`) are a product
  decision, not a code-style one — see §11 for the current inventory.

## 4. Components

- **shadcn/ui first.** Check [ui.shadcn.com](https://ui.shadcn.com/) before building
  any UI primitive by hand. Existing primitives live in `src/components/ui/`.
- Compose from primitives rather than forking them.

## 5. Theming

- The app supports **light and dark** themes. Every UI change must be verified in both.
- Use semantic Tailwind tokens (`bg-background`, `text-foreground`, `border-border`,
  `text-muted-foreground`) — never hardcoded colors.

## 6. Internationalization

- **UI and base text are ALWAYS authored in English.** All other languages come
  through i18n (`next-intl`, keys in `messages/*.json`).
- Never hardcode user-facing strings in components — add a key and use `t()`.
- When adding an English key, add it to **all** locale files: `ar`, `de`, `en`, `es`,
  `fr`, `he`, `ro`.
- **Exception — Daily Game content.** Puzzle words/themes/hints are translated at
  runtime by Gemini and cached, not stored in `messages/*.json`. See
  [knowledge base/daily_game_translation_cache.md](knowledge%20base/daily_game_translation_cache.md).

## 7. RTL Support

The app runs LTR (en/de/es/fr/ro) and RTL (he/ar) from the same markup.
**Strictly use CSS Logical Properties.** Tailwind directional utilities only:

| Use | Never use |
| :--- | :--- |
| `ms-*` / `me-*` | `ml-*` / `mr-*` |
| `ps-*` / `pe-*` | `pl-*` / `pr-*` |
| `start-*` / `end-*` | `left-*` / `right-*` |
| `text-start` / `text-end` | `text-left` / `text-right` |
| `border-s` / `border-e` | `border-l` / `border-r` |
| `rounded-s-*` / `rounded-e-*` | `rounded-l-*` / `rounded-r-*` |

**Exception:** vendored shadcn primitives in `src/components/ui/` may retain
upstream physical properties until upstream changes them — do not fight the library.
Everything in `src/components/` outside `ui/` and everything in `src/app/` must be logical.

## 8. Error Handling & The Debugger

This app is built by an AI agent and QA'd by a human. **Logs are the shared
communication channel** — the human reads them and relays them back. Optimize for
that handoff.

- **Every error is caught and logged.** No silent failures, no bare `catch {}`.
- Use the central logger (`src/lib/logger.ts`) — not raw `console.*`.
- Every log entry must carry enough context to identify the source without
  guesswork: a **scope** (module/feature), the **operation** attempted, relevant
  **identifiers** (game id, user id, locale, play date), and the **original error**.
- Write messages a human can relay verbatim. `"[daily/generate] Gemini returned
  malformed chain for play_date=2026-08-21, falling back to curated pool"` is useful.
  `"error"` is not.
- User-facing failures degrade gracefully: show an actionable message (via i18n),
  never a raw stack trace or a blank screen.
- **Debug mode** is toggleable from Settings (§9). When on, verbose diagnostics are
  emitted; when off, only warnings and errors.

## 9. Settings Area

The app has a Settings area ([src/components/Settings.tsx](src/components/Settings.tsx))
for user-controlled configuration: profile, theme, language, audio, notifications,
and the **debugger toggle**.

> **API keys are NOT stored or entered here.** See §12 — this deviates from the
> base ruleset for security reasons and is flagged for review.

Server-side secrets (Gemini, Supabase service role) live in `.env` and are read
server-side only. Operational controls that need a UI belong in the **admin area**
(`src/app/[locale]/admin/`), gated by `profiles.is_admin`.

Game balance that a game master should be able to change without a deploy lives
in the `game_settings` table, edited at `/admin/game-settings`. The constants in
`gameConfig.ts` remain the floor beneath it, so an unreachable table degrades to
today's behaviour rather than breaking the game. See
[knowledge base/game_master_guide.md](knowledge%20base/game_master_guide.md).

## 10. Documentation

- `knowledge base/` is the project's living documentation — schema, game logic,
  cron jobs, translation caching, analytics events.
- **Update it in the same change that alters behavior.** Docs drifting from reality
  is treated as a defect.
- Document both the **technical** flow (what calls what) and the **logical/user**
  flow (what the player experiences).

## 11. Testing

- [Vitest](https://vitest.dev/) for unit and integration tests. **Any added logic
  gets a test.** Scoring, ciphering, and turn rotation are especially load-bearing.
- Run `npm test` before declaring work done.

## 12. Data & Infrastructure

- **Supabase for everything**: database, auth, realtime, storage, edge functions.
  No ORM — raw `@supabase/supabase-js`.
- Schema changes go through **migrations** in `supabase/migrations/`. Never apply
  DDL by hand in the SQL editor — it desyncs migration history from the repo.
- **Never edit `.env`.** If a variable needs to change, ask the human.
- Next.js 16+: middleware is deprecated and renamed to **proxy**.
- PostHog is available for analytics and debugging.

## 13. Working With the Human

The human is an active collaborator, not just a reviewer. **Ask them** to:

- Run QA passes and report what they observe.
- Fetch information from the web when that is faster or more thorough than an agent.
- Perform checks the agent cannot (visual/device testing, production dashboards,
  Supabase writes while MCP is read-only, third-party console access).

Asking is expected and encouraged. Do not guess when a human check would settle it.

---

## 14. Git Workflow

This repo is managed by a single developer. Optimise for low ceremony.

- **Commit directly to `master` and push.** Do not create feature branches or
  pull requests unless explicitly asked for one. The extra review round-trip
  buys nothing on a solo project.
- **Do not leave the working tree dirty.** Commit finished work as part of the
  change that produced it. A lingering uncommitted diff is noise, not a safety
  net — if something is worth keeping, commit it; if it isn't, remove it.
- Unrelated changes still get their own **commit** — just not their own branch.
- `master` is the production branch: pushing triggers a Vercel production
  deploy. Run `npm test` and verify locally before pushing, since there is no
  CI gate and no PR preview to catch a mistake.

---

## 15. Browser Testing

The app has four first-run overlays that will cover the UI during an automated
browser pass: the lobby onboarding dialog, the daily walkthrough tour, the
welcome theme card, and the hint tooltip. **Assume one is in the way** — a blank
or unresponsive-looking preview is far more often an overlay than a bug.

Before testing a page, pre-seed the two localStorage keys, then navigate:

```js
localStorage.setItem('daily_tutorial_seen', 'true');
localStorage.setItem('associ8-hint-tooltip-seen', 'true');
```

The welcome card is on a timer and cannot be skipped — wait ~3s after landing on
`/daily` before reading the page or screenshotting. The onboarding dialog is
gated on a **database** column, so localStorage will not clear it; click through
it or ask the human (§13).

Full inventory, gates, timings, and the Escape-does-not-persist trap:
[knowledge base/testing_overlays.md](knowledge%20base/testing_overlays.md).

Run the dev server through the Browser pane (`.claude/launch.json`, config
`associate-dev`), never as a bare shell command.

---

## Known Debt (grandfathered, tracked for cleanup)

Measured 2026-08-21. These predate the rules above; they are exempt from
"fix it now" but must not get worse.

**No files remain over the 350-line cap.** Every file that predated it has been
refactored under it, and the ratchet in [eslint.config.mjs](eslint.config.mjs)
is now empty — the global `max-lines` rule governs the whole codebase with no
exceptions.

Cleared over 2026-08-21/22, all following the same shape — hooks for behaviour,
components for JSX, one pure tested module for the rules:

| File | Before | After | Split into |
| :--- | ---: | ---: | :--- |
| `useGameLogic.ts` | 1104 | 145 | `src/hooks/classic/` + `src/lib/classicGame/` (54 tests) |
| `DailyGameClient.tsx` | 1105 | 292 | `src/components/daily/` + `src/lib/daily/` (39 tests) |
| `ChatArea.tsx` | 683 | 150 | `src/components/game/chat/` (22 tests) |
| `InfoScreen.tsx` | 589 | 138 | `src/components/game/info/` (7 tests) |
| `Lobby.tsx` | 573 | 145 | `src/components/lobby/` (15 tests) |
| `api/game/[id]/action/route.ts` | 572 | 82 | `src/lib/gameActions/` (22 tests) |
| `CipherText.tsx` | 546 | 101 | `src/components/cipher/` (34 tests) |
| `GameHeader.tsx` | 525 | 249 | `src/components/game/header/` (21 tests) |
| `GameInput.tsx` | 516 | 200 | `src/components/game/input/` (23 tests) |

Do not add ratchet entries. A new file lands under the cap or it does not land;
a file that has grown past it needs splitting, not pinning.

**Other open items:**

`npm run lint` reports **0 errors, 91 warnings**. Every rule in this document is
enforced and green.

| Count | Rule | Severity | Note |
| ---: | :--- | :--- | :--- |
| 0 | `@typescript-eslint/no-explicit-any` | error | cleared 2026-08-21 |
| 0 | `no-restricted-syntax` (RTL) | error | cleared 2026-08-21, 3 annotated exceptions |
| 0 | `no-console` | error | cleared 2026-08-21 |
| 0 | `prefer-const`, `ban-ts-comment`, `no-require-imports`, `react/no-unescaped-entities`, `react-hooks/immutability`, `react-hooks/purity` | error | cleared 2026-08-21 |
| 16 | `react-hooks/set-state-in-effect` | **warn** | deliberate, see below |
| 64 | `@typescript-eslint/no-unused-vars` | warn | |
| 18 | `react-hooks/exhaustive-deps` | warn | |

### `react-hooks/set-state-in-effect` is warn, not error

React 19's compiler lint flags every `setState` reachable from an effect body.
The sixteen current sites are all legitimate external-system synchronisation, which
is what effects exist for:

- `LandingPage`, `Lobby` — read `localStorage` on mount (unavailable during SSR).
- `admin/posthog` — waits on the PostHog SDK to report readiness.
- `NotificationCenter`, `InvitePlayer`, `useLobbyGames` — kick off a fetch /
  realtime subscription.
- `useOnboarding` — opens the tutorial once the profile has loaded.
- `useCountUp`, `useWelcomeOverlay`, `useHintNudge`, `useHintTooltip`,
  `useAutoHint`, `useDailyGame`, `useDailySettings` — sync animation or
  preference state to changed props.

The count rises as files are split, which is expected rather than alarming:
extracting an inline closure into a named hook makes a setState the analyser
could not previously trace visible to it. Nothing new is introduced.

The `CipherText` pair are the only two worth revisiting: they are genuinely
derived-state-in-an-effect, but untangling them means rewriting an animation
state machine that masks the game's answers, so it needs its own change with a
QA pass — not a drive-by fix.

**Three RTL sites remain physical**, each annotated inline with an
`eslint-disable-next-line no-restricted-syntax` and a reason. Grep `TODO(rtl)`:

- `Lobby.tsx` — decorative blur blob, `right-0` paired with `translate-x-1/2`.
- `DailyEndGamePopover.tsx` — decorative watermark icon, offset by `translate-x-4`.
- `GameHeader.tsx` — `left-1/2` + `-translate-x-1/2` centering. This one is
  genuinely direction-neutral and correct as written; the rule flags it anyway.

The first two need a design call on whether decorative ornaments should mirror
in Hebrew/Arabic (§13).

- 1 non-TS source file: `scripts/debug-profiles.js`.
- `scripts/test-generate-hints-v2.ts` is dead: it says so in its own output and
  cannot resolve the `@/` aliases it needs. Candidate for deletion.
- Hardcoded English UI copy (a §6 violation) in `src/app/[locale]/join/[gameId]/page.tsx`
  and `src/app/[locale]/not-found.tsx` — neither page uses `next-intl`.
- Pre-existing hydration mismatch on `/[locale]`: Radix `useId` values differ
  between server and client for the footer language `Select` and the
  `FeedbackForm` `Dialog`. Verified unrelated to the debug-mode work.
- The daily game's welcome overlay never unmounts. After the 2.5s timer the
  backdrop fades to `opacity: 0` but `AnimatePresence` never removes the tree.
  The cause is **not** the no-op `exit` variant this entry used to blame:
  removing it changes nothing, and neither does mounting the header's shared
  `layoutId` copy only after the handoff. The two copies coexist for the exit
  window and framer appears to hold the exiting one because of that.

  This entry also used to say "the game stays usable". It was not: `opacity: 0`
  still receives pointer events, so the invisible sheet sat at `z-50` over the
  header and the whole board. Measured 2026-08-22 with `elementFromPoint` —
  Back and Settings were both unreachable and the message list could not be
  dragged; only the input row, which paints in a later sibling, still worked.

  Fixed by making the lingering mount inert: the root is now
  `pointer-events-none` and `aria-hidden`. Every hit test now lands on real
  content. The residual debt is one dead node in the DOM, which is cosmetic.
- `GameHeader` accepts `loading`, `solvingTimeLeft` and `onRefresh` and reads
  none of them. Marked `@deprecated` rather than removed; `DailyGameClient` no
  longer passes them, so only the classic game page still does.
- `src/components/game/DailyGameTutorial.tsx` (100 lines) is orphaned. Its
  `open` prop was wired to state that nothing ever set to true, so it could
  never appear; the real tutorial is the walkthrough tour. Nothing imports it
  now. Candidate for deletion.
- `src/types/database.types.ts` (590 lines) is a generated artifact and is
  exempt from the §2 line cap.
- Emojis in ~8 component files and in `messages/*.json` copy (10–13 per locale).
- Five migrations are written but **not yet applied**:
  `20260822090000_lock_down_function_execute.sql`,
  `20260822090100_pin_function_search_path.sql`,
  `20260822090200_document_api_usage_rls.sql`,
  `20260822140000_create_game_settings.sql` and
  `20260823090000_add_settings_revision_to_daily_results.sql`.
  For the first, deploy the app first — it removes the EXECUTE grant the
  pre-deploy code relied on for `distribute_game_points`. See
  [knowledge base/database_security.md](knowledge%20base/database_security.md).
  The last two are additive and independent of the others; until they are
  applied the game runs on compiled defaults and results record without
  attribution, both of which are logged with the filename to apply. See
  [knowledge base/game_master_guide.md](knowledge%20base/game_master_guide.md).
- `GameSettingsRow` in `src/types/app.ts` is hand-written because its table's
  migration is not applied yet, so the generated types do not know it exists.
  Regenerate `database.types.ts` after applying and swap in the generated alias.
- Migration history drift: `add_message_type` and `create_translation_generations`
  exist as local files but were applied by hand and are absent from remote history;
  four remote migrations have no local file.
