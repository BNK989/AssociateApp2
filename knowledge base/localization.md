# Localization & Language Auto-Detection

How a player ends up reading Associ8 in their own language, and where the
supported-language list lives.

## The single source of truth

[`src/i18n/locales.ts`](../src/i18n/locales.ts) declares every language the app
ships. Nothing else may hardcode a locale list.

| Export | Purpose |
| :--- | :--- |
| `locales` | The shipped locales, in language-picker order. |
| `defaultLocale` | `en` — the authoring language (CLAUDE.md §6). |
| `rtlLocales` | `he`, `ar`. |
| `localeLabels` | Native names for the picker (`עברית`, not "Hebrew"). |
| `isSupportedLocale(value)` | Type guard for untrusted locale strings. |
| `getLocaleDirection(locale)` | `'rtl' | 'ltr'`, defaulting for unknown input. |

Currently shipped: **en, he, ar, es, fr, de, ro** — seven, matching the seven
files in `messages/`.

### Adding a language

1. Add `messages/<locale>.json` with every key from `en.json`.
2. Add the locale to `locales` and `localeLabels` in `src/i18n/locales.ts`
   (and to `rtlLocales` if it is right-to-left).
3. Run `npm test`.

That is the whole change. The routing config, the language picker, the daily
puzzle translation pipeline and the admin translations dashboard all derive
from the list, so there is nothing else to keep in step.

Two test files enforce this and will fail the build if you miss a step:
`src/i18n/locales.test.ts` (list ↔ `messages/` files must match exactly, in
both directions) and `src/i18n/i18n.test.ts` (every locale file has every key
from `en.json`).

## How a first-time player's language is chosen

[`src/i18n/routing.ts`](../src/i18n/routing.ts) configures `next-intl` with
`localeDetection: true` and `localePrefix: 'as-needed'`. The middleware in
[`src/proxy.ts`](../src/proxy.ts) resolves, in order:

1. **A locale prefix already in the URL** — `/he/daily` wins outright.
2. **The `NEXT_LOCALE` cookie** — written when a player picks a language in
   `LanguagePicker`, and kept for a year.
3. **The `Accept-Language` header** — i.e. the player's *device* language.
   This is the branch a brand-new visitor hits.
4. **`defaultLocale`** (`en`).

So a player whose phone is set to Hebrew, arriving at `associ8game.com` for the
first time, is redirected to `/he` and gets Hebrew copy with `dir="rtl"`. A
player whose phone is set to a language we do not translate gets English.

`en` has no prefix (`as-needed`), so English players stay on `/`.

### Consequence for `usePathname`

Because non-default locales carry a prefix, always import `usePathname` from
`@/navigation` rather than `next/navigation` — see
[game_shell_layout.md](game_shell_layout.md).

## The saved profile language

`LanguagePicker` writes the chosen locale to `profiles.settings.language` for
logged-in players, but **routing never reads it** — the `NEXT_LOCALE` cookie
does that job. The stored value is only read back by
[`Settings.tsx`](../src/components/Settings.tsx) to render the dropdown.

Practical effect: a logged-in player who opens the app on a *new device* gets
device-language detection, not the language saved on their profile, until they
pick one. Deliberate for now; making the profile authoritative would mean a
server-side redirect on first load after auth.

## Daily puzzle content

Puzzle words, themes and hints are **not** in `messages/*.json`. They are
translated at runtime by Gemini and cached per locale — see
[daily_game_translation_cache.md](daily_game_translation_cache.md). The daily
page translates for any locale in `locales` and serves the English content for
anything else.

## History: the 19-locale drift

Until 2026-09-06 `routing.locales` declared nineteen languages while only seven
had translations. `it`, `pt`, `ja`, `zh`, `ru`, `hi`, `tr`, `nl`, `pl`, `sv`,
`vi` and `th` were all *detectable*: a player on an Italian device was
redirected to `/it`, the message import in `src/i18n/request.ts` threw, and a
bare `catch` silently substituted the English copy. The result was English text
served under `<html lang="it">` on an `/it` URL, with a language picker whose
value matched none of its options so it rendered blank.

Trimming the list to the seven translated languages makes that fallback
unreachable — an unshipped device language now resolves to `en` at step 4
above. The remaining `catch` in `request.ts` logs at `error` level (CLAUDE.md
§8) because reaching it now means a messages file is missing from the build.

The same commit removed the duplicate locale lists in `LanguagePicker`, the
daily page and the admin translations page, and the duplicate locale group in
the `proxy.ts` matcher — the drift was only possible because the list existed
in five places.

It also fixed three components that tested `locale === 'he'` for direction and
so rendered **Arabic left-to-right**: `NavBar`, `NotificationCenter` and
`AuthForm` now call `getLocaleDirection`.
