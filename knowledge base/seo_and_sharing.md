# SEO, Sitemap and Link Previews

How the site presents itself to a crawler and to a chat app's link preview.
Written 2026-09-15, when all three were found to be either broken or absent.

Companion docs: [events.md](events.md) covers `?ref=` attribution once a reader
actually arrives.

---

## 1. The trap: `/sitemap.xml` and `/robots.txt` had never worked

Both files existed in `src/app/` and both answered **404 in production for as
long as they had existed**. No crawler has ever read either one.

The cause is the next-intl proxy matcher in [src/proxy.ts](../src/proxy.ts).
Its negative lookahead excluded `api`, `_next` and a list of media extensions,
but nothing ending `.xml` or `.txt`. So `/sitemap.xml` went through the intl
middleware, which rewrote it to `/en/sitemap.xml` — not a route — and Next
answered 404. The route file was correct the whole time; it was simply never
reached.

Both filenames are now named explicitly in the lookahead. **Anything else
unlocalised added at the site root has the same problem** — `ads.txt`,
`.well-known/*`, a verification file a search console asks you to drop in — and
will 404 silently until it is excluded there too. The symptom is a 404 on a file
you can see in the repo.

Verify after any proxy change:

```bash
curl -sI http://localhost:3000/sitemap.xml | head -1
curl -sI http://localhost:3000/robots.txt  | head -1
```

## 2. Sitemap

The rules live in [src/lib/seo/siteUrls.ts](../src/lib/seo/siteUrls.ts), not in
the route. A Next route file is a default export the framework calls, which
makes it untestable; the module beside it is pure and carries 16 tests.

`src/app/sitemap.ts` is four lines that call `buildSitemapEntries(new Date())`.

- **`PUBLIC_PAGES`** is the list: `''` (landing), `/daily`, `/privacy`,
  `/terms`. Four pages × seven locales = **28 URLs**.
- The previous hand-written list had four URLs, one of which (`/login`) is not
  a route, and did not include `/daily` — the page the whole product is about.
- The default locale (`en`) is **unprefixed**: `https://associ8game.com/daily`,
  never `/en/daily`. `localePath` enforces this and a test asserts no URL in the
  sitemap begins `${SITE_ORIGIN}/en`.
- Every row carries the full `alternates.languages` set (all seven locales plus
  `x-default`, which points at the unprefixed English URL). That is the hreflang
  signal telling Google the seven URLs are one page in seven languages rather
  than seven thin duplicates.
- Translated rows are priced at 80% of the canonical locale's priority, so the
  English URL outranks its own translations when Google picks one.

**Private paths are excluded here and disallowed in `robots.ts`. The two lists
have to agree** — `/admin`, `/settings`, `/thank-you`. Tests assert their
absence from the sitemap.

`robots.ts` lists each private path **twice**: the bare path for the default
locale, and a `/*/admin/` wildcard for the other six. A rule for the unprefixed
form alone leaves six doors open.

## 3. Canonicals belong on pages, not on the layout

`alternates` is set in each page's `generateMetadata`
(`[locale]/page.tsx`, `[locale]/daily/page.tsx`) via `pageAlternates(locale, path)`.

It must **not** move to the shared layout, however tempting the deduplication
looks. Next metadata *inherits*: a canonical on `[locale]/layout.tsx` would tell
crawlers that `/he/daily` is really `/he`, dropping the daily game out of six
language indexes at once.

## 4. Open Graph cards

Rendered at request time by `next/og` (Satori) from the shared renderer in
[src/lib/seo/ogCard.tsx](../src/lib/seo/ogCard.tsx), through two
file-convention routes:

| Route | Card |
| :--- | :--- |
| `[locale]/opengraph-image.tsx` | Brand card — "Associ8" + the one-line pitch |
| `[locale]/daily/opengraph-image.tsx` | "ASSOCI8 · PUZZLE #262" eyebrow + today's chain |

Constraints that are not obvious and will bite:

- **Satori cannot parse `oklch`.** The brand purple is spelled `#9333ea` in
  `ogCard.tsx` — the hex behind `--brand`. This is the one place a hardcoded
  colour is correct (CLAUDE.md §5 assumes a browser); it cannot use the token.
- **No block layout.** Every node with more than one child needs an explicit
  `display: flex`, or Satori throws.
- **The cards are deliberately not translated.** Satori embeds only the fonts
  you hand it, and the defaults have no Hebrew or Arabic coverage — a localised
  card would render tofu boxes. Only `og:locale` varies by locale.
- **The daily card reads no database.** The puzzle number comes from
  `dailyPuzzleNumber(today)`, which is pure date arithmetic against
  `DAILY_EPOCH`. A crawler that times out on Supabase would otherwise get a
  blank card, and a blank card is worse than a generic one.
- The tile row is eight `div`s, not emoji squares (CLAUDE.md §3).

`[locale]/layout.tsx` names **no** `openGraph.images` or `twitter.images`.
Naming one beats the file convention, and the 512×512 square it used to name was
letterboxed into an unreadable blob inside a 1.91:1 `summary_large_image` slot.

Check a card by fetching it — it is a real route:

```bash
curl -sI http://localhost:3000/daily/opengraph-image | head -3
```

## 5. What to watch once it is live

- Submit `https://associ8game.com/sitemap.xml` in Google Search Console. Nothing
  has ever been submitted, so the index currently holds only whatever was
  crawled by following links.
- Coverage should settle at 28 URLs. Fewer means the proxy matcher regressed.
- Paste a `/daily` link into WhatsApp or X to see the card; both cache
  aggressively, so use the platform's own debugger after a change rather than
  trusting a re-paste.
