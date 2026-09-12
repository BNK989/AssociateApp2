# Overlays That Block Browser Testing

Four first-run overlays can cover the UI during an automated browser pass. They
are all *correct* product behaviour — the point of this document is that an
agent driving the preview does not mistake one for a broken page, and knows how
to get past it without changing product code.

## The inventory

| Overlay | Where | Gate | Timing |
| :--- | :--- | :--- | :--- |
| Onboarding tutorial | Lobby (`/[locale]`, signed in) | `profiles.has_seen_onboarding === false` (**DB**) | Immediately once the profile loads |
| Daily walkthrough | `/[locale]/daily` | `localStorage.daily_tutorial_seen` + `profiles.settings.daily_tutorial_seen` | ~1000 ms after the puzzle words load |
| Welcome theme card | `/[locale]/daily` header | none — always on entry | 2500 ms on screen + 500 ms dock animation |
| Hint tooltip | `GameInput`, any game | `localStorage['associ8-hint-tooltip-seen']` | 5000 ms of no interaction |

Source: [useOnboarding.ts](../src/components/lobby/useOnboarding.ts),
[useDailyTutorial.ts](../src/components/daily/useDailyTutorial.ts),
[useWelcomeOverlay.ts](../src/components/game/header/useWelcomeOverlay.ts),
[GameInput.tsx](../src/components/game/GameInput.tsx).

## Get past them

**Pre-seed localStorage before the page loads.** This clears the walkthrough and
the hint tooltip, which is most of the problem:

```js
localStorage.setItem('daily_tutorial_seen', 'true');
localStorage.setItem('associ8-hint-tooltip-seen', 'true');
```

Order matters. The keys are read on mount, so: `preview_start` → `javascript_tool`
to set them → `navigate` to the page under test. Setting them on a page that has
already mounted does nothing until a reload.

**The welcome card cannot be skipped.** Budget ~3 s after landing on `/daily`
before reading the page or taking a screenshot, or you will capture the theme
card mid-animation and read it as a layout bug.

**The onboarding tutorial lives in the database**, so localStorage will not touch
it, and the Supabase MCP is read-only (§13). Either click through the dialog —
finishing it writes `has_seen_onboarding: true` for that account and it never
returns — or ask the human to flip the column. Escape also closes it and
persists, because the Radix `onOpenChange` handler calls `completeTutorial`.

## What the tour does to a page under test

**Escape persists.** It used not to: the auto-start passed no
`WalkthroughOptions`, so `endTour(false)` had no `onSkip` and only the last step
wrote the flag. `useDailyTutorial` now passes `onSkip: markSeen` on both the
first run and a restart, so any exit counts. Pre-seeding the key is still the
faster route.

**The tour grabs global keys while open** — `Escape`, `ArrowLeft`, `ArrowRight`
are captured by `WalkthroughProvider` on `window`, so keyboard input aimed at
the game goes to the tour until it closes. The arrows follow *reading* order:
under `dir="rtl"` (he/ar) ArrowLeft advances and ArrowRight goes back.

**The tour scrolls.** Each step calls `scrollIntoView({ block: 'center' })` on
its target, so the message list is somewhere new by the time the card appears.
Screenshot comparisons taken across a step boundary will differ for that reason
alone.

**The highlight is a real hole.** Clicks inside the cutout reach the element
underneath — that is deliberate, so a player can try the control being
described. An automated click aimed at the board during a tour will land.

## Restoring the overlays

To test the first-run experience itself, invert the above: clear the two
localStorage keys, and use the in-app "restart tutorial" control on the daily
screen (`tutorial.restart`) rather than editing the database.

The tour's own chrome lives in [src/components/walkthrough/](../src/components/walkthrough/)
— card, scrim and the pure placement module it asks where to sit. It used to sit
under `src/components/ui/`, which the ESLint config exempts from the RTL rule on
the grounds that everything there is vendored shadcn. This never was, so it had
been quietly skipping CLAUDE.md §7 the whole time; moving it put it back under
the rule.
