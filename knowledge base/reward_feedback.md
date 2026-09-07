# Reward Feedback

How a correct guess feels: the chime, the "+points" burst, the sparks and the
haptic tap. What a game master controls, what a player controls, and how the two
resolve against each other.

Written for both audiences — a person tuning reward feel, and an agent asked to
change or extend it.

---

## 1. The problem this replaced

Before 2026-09-07 a solve produced two fixed things:

- one mp3 (`/sounds/notifications/correct-choice.mp3`) at a fixed 0.6 volume, and
- a green `+N` that floated up and faded.

Both were **identical for every solve**. A player who cracked a word unaided on
a five-solve streak and a player who was handed the answer by the AI clue got
the same chime and the same green number. Uniform feedback for unequal
achievements is the fastest way to make a reward stop meaning anything: within a
session the sound becomes a metronome and the number becomes furniture.

Two smaller faults went with it:

- **The solve chime ignored the player's own sound toggle.** `enable_audio_chime`
  was honoured by `useTurnNotifications` (classic mode's turn sounds) and by the
  info screen's preview, but `useSuccessSound` never read it. A player who
  switched sound off in the daily game still heard every solve.
- **A wrong guess was silent.** The bubble shook, which is easy to miss on a
  phone held one-handed, and nothing confirmed the guess had registered.

---

## 2. Grading a solve

Everything below is scaled by one decision, made once per solve in
[`src/lib/daily/feedbackTiers.ts`](../src/lib/daily/feedbackTiers.ts) and handed
to both the sound and the visuals. They cannot disagree because there is nothing
to disagree with.

```
ratio = points awarded / the word's untouched value
```

**The ratio, not the raw points.** A word's base value is `10 + its length`, so
raw points mostly measure how long the word happened to be. Celebrating
`encyclopaedia` harder than `cat` rewards the puzzle, not the player. The ratio
measures the only thing the player controlled: how much of the word's value they
kept.

| Tier | Ratio | What it means | Sound | Look |
| :--- | :--- | :--- | :--- | :--- |
| `assisted` | < 0.5 | Took the AI clue (40% on its own) | One soft sine note | Muted slate `+N`, no sparks |
| `solid` | 0.5 – 0.95 | The everyday solve, maybe a cheap hint | Root and fifth | Emerald `+N`, sparks |
| `clean` | ≥ 0.95 | No hints taken | Major arpeggio to the octave | Gold `+N`, glow, more sparks |

**Streaks are a separate axis.** Once `consecutive ≥ STREAK_BONUS_AT` (3) — the
same point the score multiplier starts — each further solve climbs one rung of a
five-rung major pentatonic ladder, capped at `MAX_STREAK_STEP`. The player
*hears* the bonus start at the moment they start earning it. A streak also adds
sparks and puts a flame chip carrying the multiplier next to the number.

A streak-boosted solve has a ratio above 1 (the multiplier is 1.5×). That is
deliberate: it must not fall out of the top tier by overshooting it, which is
what the `>= CLEAN_AT` comparison guarantees and what
`feedbackTiers.test.ts` pins.

---

## 3. The sound

Synthesised through the Web Audio API, not sampled. Note material is
[`src/lib/audio/rewardNotes.ts`](../src/lib/audio/rewardNotes.ts) (pure, tested);
the oscillators are [`rewardSynth.ts`](../src/lib/audio/rewardSynth.ts).

Three reasons for synthesis, in the order they mattered:

1. **A streak that transposes upward is impossible with a fixed mp3.** Pitch is
   the cheapest, most legible escalation there is, and it is free here.
2. **Every parameter is reachable from the admin panel**, so reward feel can be
   tuned without a deploy — the same argument as the hint policy.
3. It costs no bandwidth at all, against the ~10KB the single chime it replaced
   was downloading.

**The shape is the message, the pitch is the accent.** One note means "counted",
two mean "good", four mean "you did that yourself". A player learns the
difference in a handful of solves without being told, and can still tell the
tiers apart with the volume right down. That is why the tiers differ in *note
count* rather than in loudness.

Details that matter if you touch this:

- **Root is C5 (523.25 Hz).** High enough to cut through, low enough not to be
  shrill on a phone speaker.
- **Envelopes are percussive** — 8ms attack, exponential decay. A plucked shape
  reads as an event; a sustained one reads as a notification.
- **Every tone is detuned by up to ±7 cents at random**, so a hundred solves in
  a row never sound mechanically identical.
- **The `AudioContext` is created lazily inside a user gesture** and resumed on
  every gesture and before every play. Browsers start it suspended, and a tab
  switch suspends it again — without the resume-before-play the first solve
  after returning to the tab is silent.
- **The miss tone falls** (a minor third glide, below the root, quieter than any
  solve). A falling pitch is the most legible "no" there is and cannot be
  mistaken for a reward. It is short enough to finish before the shake does; a
  miss already costs a strike, so the sound does not need to punish as well.

---

## 4. The visuals

[`SolveBurst.tsx`](../src/components/game/chat/SolveBurst.tsx), with the scaling
rules in [`solveBurstStyles.ts`](../src/components/game/chat/solveBurstStyles.ts)
so they can be tested without rendering.

- The number **overshoots, settles, then drifts**. The overshoot is what makes
  it read as an impact rather than a fade-in.
- Sparks are absolutely-positioned motion `<span>`s on **index-derived angles**,
  not random ones: identical on every render of the same solve, and not a
  hydration hazard the day this renders on the server.
- The **solved bubble's ring is tiered too** — it used to be green whatever
  happened.
- Gold is reserved for `clean`. A colour every solve earns is just the colour of
  solving.

**Reduced motion is honoured properly**, not by shortening the animation: the
number fades in place and sparks are not rendered at all. The tier's colour,
size and chip still appear, so no information is carried by motion alone. The
whole flourish is `aria-hidden`; one `sr-only` `role="status"` line announces
the points and the streak once.

---

## 5. What a game master controls

**`/admin/game-settings` → "How a correct guess feels"**. Key `daily_feedback`
in `game_settings`.

| Setting | What it does |
| :--- | :--- |
| **Reward sound** | Master switch for the chime. |
| **Volume** | The ceiling, 0–1. A player's own volume scales this *down*, never up. |
| **Streaks raise the pitch** | Off, the tiers still differ but stop climbing. |
| **Wrong-guess tone** | The falling miss note. |
| **Spark burst from** | Lowest tier that throws sparks, or `off`. |
| **Flourish** | 0–1 scale on the size, travel and spark count of every animation. |
| **Haptics** | Short vibration where supported. Ignored on desktop and iOS Safari. |

The panel's **preview buttons play the draft**, not what is saved — including
the volume and streak-pitch switches above them. Reward feel is not something
anyone can judge from a number, so every control is one button away from being
heard. A preview of the *saved* policy would be actively misleading while the
form is dirty.

**Flourish 0 does not make scoring invisible.** The number still appears at its
baseline size; it just stops moving and sparking. Turning celebration down
should give a calmer game, not a broken one. `solveBurstStyles.test.ts` pins
this.

---

## 6. What a player controls

In the in-game info screen (the gear, or the header's score area):

| Control | Stored as | Notes |
| :--- | :--- | :--- |
| **Game Sounds** switch | `profiles.settings.enable_audio_chime` | Persists immediately — a player who mutes and closes the tab stays muted. |
| **Volume** slider | `profiles.settings.audio_volume` | Live while dragging, written when the screen closes. Only shown when sound is on. |

Guests store the same keys in `localStorage` under `daily_game_settings`.

### The one asymmetry with the hint policy

The hint policy has a `force` scope that overrides every player. **Reward audio
does not, and must not.** `resolveFeedbackPolicy` gives the player's mute the
final word:

```
soundEnabled = gameMaster.soundEnabled && player.soundEnabled !== false
volume       = gameMaster.volume * player.volume
```

A game master tuning reward feel has no business un-muting anybody, and a site
that plays sound at someone who switched it off is a site they leave. The
`scope` column is written as `'default'` for this key and never read.

---

## 7. For agents working on this

### Where the logic lives

| Concern | File |
| :--- | :--- |
| Grading a solve | `src/lib/daily/feedbackTiers.ts` |
| Game-master policy, parser, resolution | `src/lib/daily/feedbackPolicy.ts` |
| Compiled floor | `REWARD_FEEDBACK` in `src/lib/gameConfig.ts` |
| Note material | `src/lib/audio/rewardNotes.ts` |
| Oscillators, context lifecycle | `src/lib/audio/rewardSynth.ts` |
| Sound + haptics orchestration | `src/hooks/useRewardFeedback.ts` |
| The flourish | `src/components/game/chat/SolveBurst.tsx`, `solveBurstStyles.ts` |
| Where it is triggered | `src/components/daily/useDailyGame.ts` (`solve`) |
| Player preferences | `src/components/game/info/useInfoSettings.ts`, `resolveInfoSettings.ts` |
| Resolved policy for the board | `src/components/daily/useDailySettings.ts` |
| Admin panel | `src/components/admin/gameSettings/FeedbackSection.tsx` |
| Read on the server | `getDailyFeedbackSettings` in `src/lib/gameSettings/server.ts` |
| Write path | `src/lib/gameSettings/writeSetting.ts`, `/api/admin/game-settings` |

### Invariants — do not break these

1. **The compiled constants are the floor.** A missing `daily_feedback` row, a
   missing table, or a malformed blob must play exactly like `REWARD_FEEDBACK`.
   `parseFeedbackPolicy` falls back **per field**, never wholesale.
2. **A muted player stays muted.** There is no code path where a game-master
   setting turns sound on for someone who turned it off.
3. **The grade is computed once.** Sound and visuals both consume the same
   `SolveFeedback`. Do not re-derive a tier anywhere else.
4. **Volume reaching a gain node is always a finite 0–1.** Both `unitScalar`
   (policy) and `clampVolume` (player) exist for this; a `NaN` here is a silent
   `AudioContext` for the rest of the session.
5. **`STREAK_LADDER` is exactly `MAX_STREAK_STEP + 1` long.** Pinned by a test,
   because indexing off the end returns `undefined` and produces a `NaN`
   frequency.
6. **Reward audio never blocks or delays a move.** Every failure path in
   `rewardSynth.ts` logs and returns; nothing throws into the game loop.

### Adding a setting

1. Add the compiled default to `REWARD_FEEDBACK` in `gameConfig.ts`.
2. Add the field and its parse rule to `feedbackPolicy.ts` (clamp it; fall back
   to the constant).
3. Add a test to `feedbackPolicy.test.ts` for the malformed case.
4. Add a control to `FeedbackSection.tsx`.
5. Read it wherever it applies. Nothing else changes — the write path, the
   revision counter, the audit trail and the cache expiry are shared by every
   settings key through `writeSetting.ts`.

### Adding a settings key (not just a field)

Register it in the `KEYS` map in
[`/api/admin/game-settings/route.ts`](../src/app/api/admin/game-settings/route.ts):
a parser, a compiled default, and whether `scope` means anything for it. The
revision counter, the `game_settings_history` entry and the cache expiry come
free — and are exactly the parts a second hand-written route would forget.

---

## 8. Things that will surprise you

- **The first solve after a page load may be a fraction late.** The
  `AudioContext` is built on the first gesture; if that gesture *is* the submit,
  the context is constructed and the tones are scheduled in the same tick. It is
  audible only if you are looking for it, and building the context on mount
  instead just leaves a suspended one lying around until the first click anyway.
- **iOS Safari has no `navigator.vibrate`.** Haptics silently do nothing there.
  The setting is left visible because the same account plays on Android.
- **Classic multiplayer gets the visuals but not the grading.** It has no
  per-player hint level to measure a ratio against, so `justSolved.feedback` is
  absent and `UNGRADED_FEEDBACK` renders it at `solid` — exactly the flourish it
  had before grading existed. Classic has no reward chime.
- **The free starting word is solved for 0 points**, which grades as `assisted`.
  It never renders a burst (`points > 0` gates it) and never chimes.
- **Turning volume to 0 is not the same as muting.** The chime is scheduled and
  the gain node is fed the floor value; nothing is audible, but the context
  stays warm. Muting skips scheduling entirely.

---

## Related

- [game_master_guide.md](game_master_guide.md) — the hint policy, the same
  `game_settings` table, and the revision/attribution machinery.
- [events.md](events.md) — the analytics events a solve emits.
- [logging_and_debug_mode.md](logging_and_debug_mode.md) — the `audio/reward`
  and `game-settings` log scopes.
