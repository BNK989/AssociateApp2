# Game Shell & Desktop Layout

How the game board is framed, and what changes between a phone and a wide
screen. Applies to both modes — the daily game (`/daily`) and a multiplayer
room (`/game/[id]`).

## Technical flow

Both pages render their header, chat list and input inside
[`GameShell`](../src/components/game/GameShell.tsx), which owns the frame:

```
GameShell                       fixed inset-0, height = useVisualViewport()
├── GameBackground variant="room"   hidden below md — the ambient blobs
└── card                            the board itself
    ├── GameHeader
    ├── ChatArea
    │   └── GameBackground variant="panel"   flat tint on desktop
    └── GameInput
```

The card is the full viewport below `md` (768px) and an inset, rounded,
bordered panel at `md` and above:

| | Phone (`< md`) | Desktop (`≥ md`) |
| :--- | :--- | :--- |
| Card width | `max-w-md` (448px) | `max-w-xl` (576px) |
| Card height | full viewport | viewport minus `1.5rem` top and bottom |
| Card edges | flush, no border | `rounded-2xl`, `border-border`, `shadow-2xl` |
| Behind the card | nothing visible | `GameBackground variant="room"` |
| Blobs inside the chat list | yes | no — flat surface tint only |
| Bubble max width | `70%` | `85%` |
| Message list padding | `p-4` | `p-4 md:px-6` |
| Scrollbar | native overlay | thin themed bar (`.game-scroll`) |
| Input focus on a new word | none | autofocused |

Height comes from `useVisualViewport()` rather than `100dvh` because the mobile
keyboard must shrink the board instead of pushing the input off screen. On
desktop the two are equivalent.

### Why the background has two variants

The blobs in `GameBackground.module.css` are sized in `vmin` and offset in
`vw`, so they only compose when their container is roughly the viewport. That
holds on a phone, where the board *is* the viewport. Inside a 576px column on a
1440px screen they are ~3x the container and spill out of it. So on desktop the
panel copy drops its blobs and keeps only the surface tint, and a second copy
behind the card carries the atmosphere. Rewriting the CSS in container units
would collapse this back to one copy; it has not been done.

### Overlays are fixed, and must be boxed

`InfoScreen`, `WelcomeOverlay` and `LeaveGameConfirm` are `fixed inset-0`
because they cover the board *including* its header, which they render inside.
On a phone that is the whole viewport and correct; on desktop it would spill
across the full screen while the board sits in the middle of it. They each
apply [`CARD_BOX`](../src/components/game/cardBox.ts), which repeats the card's
`md:` geometry. **Any new overlay in this family needs `CARD_BOX` too**, and
`CARD_BOX` must stay in sync with the card classes in `GameShell`.

`DailyEndGamePopover` is deliberately exempt: it is a Radix dialog and is
centred on the viewport, which is the conventional treatment for a modal.

### Site chrome

`NavBar` and `SiteFooter` both hide on game routes via
[`isImmersiveGameRoute`](../src/lib/gameChrome.ts). This is not cosmetic: the
shell is `fixed`, so it is out of flow and the layout's `<main>` collapses —
anything still mounted paints *around* the board and gives the player a second,
live set of navigation controls.

The helper takes a **locale-stripped** pathname. Use `usePathname` from
`@/navigation`, never the raw hook from `next/navigation`: routing is
`localePrefix: 'as-needed'`, so the raw hook yields `/he/daily` and every
non-default locale fails a naive prefix check. `NavBar` had exactly that bug —
the nav stayed visible over the board for every locale but English.

### What a bubble looks like depends on its stage

`ChatArea` frames the list; the individual bubble changes shape across its own
life — ciphered promise, active workspace, settled record — and the clue it
carries is only open on the word being solved. See
[chat_bubble_lifecycle.md](chat_bubble_lifecycle.md).

## Logical / user flow

On a phone nothing changed: the game is the screen, edge to edge.

On a laptop the player now sees the board as a card floating in a dim,
slowly drifting room rather than a phone-shaped strip pinned to a black
rectangle. The site nav no longer sits behind and around it. The column is
128px wider, so hints that used to wrap to three lines usually fit two. The
scrollbar is a thin themed bar rather than an OS bar with arrow buttons inside
the frame.

Typing works without a click: when a word comes up — on entry and after every
solve — the input takes focus. This is gated on `(pointer: fine)`, so a touch
device never has the keyboard thrown over the board, and an environment with no
`matchMedia` at all falls back to click-to-focus.

## Deliberately not done

A two-column desktop layout (board plus a side panel for score, streak,
players). It forks the component tree and doubles the QA surface for a
platform that is a minority of play. The card-in-a-room framing was chosen as
the cheap 90%. If the empty space should carry content later, that is a
product decision and a new component, not a tweak to `GameShell`.
