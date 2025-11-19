Here is a comprehensive Product Requirements Document (PRD) tailored for an AI developer (like Cursor, GitHub Copilot Workspace, or similar) to build "Associate Game 2.0".

---

# PRD: Associate Game 2.0

## 1. Project Overview
**Associate Game 2.0** is a web-based, multiplayer word association game with a PWA focus. It combines creativity with memory. Players build a chain of associated words, which are immediately "ciphered" (masked) after the next message is sent. The core loop involves building the chain and then switching modes to "solve" the chain backwards from memory.

## 2. Technical Stack & Constraints
*   **Frontend:** React / Next.js (App Router recommended), Tailwind CSS.
*   **Backend/DB:** Supabase (Database, Auth, Realtime subscriptions).
*   **ORM:** **None.** Use raw Supabase JS client (`@supabase/supabase-js`) with TypeScript definitions.
*   **AI Model:** Google Gemini (Cheapest available model) for hints.
*   **Deployment:** Vercel (Frontend) + Supabase (Backend).
*   **PWA:** Yes (Manifest, Service Workers, Mobile-first UI).

## 3. Configuration Management
**Strict Requirement:** Create a single file named `lib/gameConfig.ts` (or similar) to hold all game constants. The AI or Game Master must be able to tweak these values easily.

```typescript
// lib/gameConfig.ts
export const GAME_CONFIG = {
  MAX_PLAYERS: 5,
  MESSAGE_WORD_LIMIT_MIN: 1,
  MESSAGE_WORD_LIMIT_MAX: 3,
  POINTS_PER_SEND: 1,
  POINTS_PER_SOLVE: 100,
  STREAK_THRESHOLDS: [3, 5, 10], // Bonus tiers
  STREAK_BONUS_MULTIPLIER: 1.5,
  GUESS_TIMEOUT_SECONDS: 10, // Time before specific turn becomes free-for-all
  GAME_MODE_100_LIMIT: 100,
  AI_HINT_MODEL: "gemini-1.5-flash", // or current cheapest
};
```

## 4. Data Model (Supabase)
*Do not use Prisma.* Use the following schema logic. Extend as needed but keep documented.

### Tables:
1.  **`profiles`**
    *   `id` (uuid, FK to auth.users)
    *   `username` (text)
    *   `avatar_url` (text)
    *   `settings` (jsonb: { theme, language, audio_volume })
    *   `updated_at`
2.  **`games`**
    *   `id` (uuid)
    *   `status` (text: 'lobby', 'active', 'solving', 'completed')
    *   `mode` (text: 'free', '100_text')
    *   `current_turn_user_id` (uuid)
    *   `created_at`
3.  **`game_players`**
    *   `game_id` (uuid)
    *   `user_id` (uuid)
    *   `score` (int)
    *   `joined_at`
4.  **`messages`**
    *   `id` (uuid)
    *   `game_id` (uuid)
    *   `user_id` (uuid)
    *   `content` (text - *encrypted or raw depending on security pref, raw is fine for game*)
    *   `cipher_length` (int - stored separately to ease frontend logic)
    *   `is_solved` (boolean)
    *   `created_at`
5.  **`invites`**
    *   `id`
    *   `game_id`
    *   `receiver_id`
    *   `status` (pending/accepted)

## 5. Application Screens & Features

### A. Lobby
*   **Display:** List of open public games.
*   **Invites:** Distinct section showing pending game invitations.
*   **Action:** "Create Game" button.

### B. My Games
*   **Display:** List of all games the user is currently part of (active/history).

### C. User Settings
*   **Access:** Via Profile Icon click.
*   **Fields:**
    *   Edit Display Name.
    *   Edit Avatar Icon.
    *   Language Preferences (UI text).
    *   Theme: Light/Dark toggle.
    *   Audio: Volume slider for SFX.

### D. Game Room (The Core)

#### Layout & UX
*   **Mobile focus:** The input bar must stick to the keyboard top. Use the Visual Viewport API to detect keyboard height and ensure the input field is never hidden.
*   **Top Bar:** Scoreboard, Current Mode indicator, Toggle Mode button (if Host/Free mode).

#### Phase 1: Creating (Chatting)
1.  **Turn Logic:** Round-robin turns.
2.  **Input:** Validated to `GAME_CONFIG.MESSAGE_WORD_LIMIT_MIN` to `MAX`.
3.  **Display:**
    *   The **most recent** message is visible as text.
    *   **All previous** messages are rendered as **Ciphers** (visual blocks or asterisks matching string length/spaces).
4.  **Automation:** If Mode == '100_text' and message count >= 100, auto-trigger Phase 2.

#### Phase 2: Solving (Reverse Scroll)
1.  **Visual Transition:** UI changes to indicate "Solving Mode".
2.  **Direction:** The chat logic inverts. The "active" puzzle is the *last* message sent.
3.  **Scroll Behavior:**
    *   Highlight the bottom-most *unsolved* cipher.
    *   Input field expects the original text.
    *   **Success:**
        1.  Reveal text.
        2.  Mark as solved.
        3.  Auto-scroll *up* to the next cipher (historically older).
        4.  Keep the *previously solved* message (historically newer) visible at the bottom of the view for context (association logic).
4.  **Guessing Logic:**
    *   Players can type guesses.
    *   **Turn limit:** If the assigned player doesn't solve in `GAME_CONFIG.GUESS_TIMEOUT_SECONDS`, the UI broadcasts "Free for all!" and any player can input the answer.
5.  **Hints:**
    *   Action: Right-click (or long-press on mobile) on a cipher.
    *   Backend: Triggers Supabase Edge Function -> Google Gemini API.
    *   Prompt: "Give a subtle hint for the word [WORD] associated with [PREVIOUS_WORD]."
    *   Cost: Deduct points or limit usage (optional, keep logic simple for now).

## 6. Scoring System
*   **Trigger:** On `messages` insert (Send) or `messages` update (Solve).
*   **Logic:**
    *   **Send:** + `POINTS_PER_SEND`.
    *   **Solve:** + `POINTS_PER_SOLVE`.
*   **Streaks:** Track consecutive solves in `game_players` (temporary memory or column).
    *   If streak > 3/5/10, apply `STREAK_BONUS_MULTIPLIER`.

## 7. Development Guidelines for AI

### A. Testing Strategy
1.  **Unit Tests:** Test scoring logic and string ciphering utilities.
2.  **Test Route:** Create a page `/test-playground`.
    *   **Features:**
        *   Button to mock "Add 5 Messages".
        *   Button to "Force Switch to Solve Mode".
        *   Button to "Simulate Keyboard Open" (visual check).
        *   Toggle to switch between "Current User" views to test multiplayer sync without 5 browsers open.

### B. Backend Realtime
*   Use `supabase.channel` to subscribe to:
    *   `INSERT` on `messages` (New chats).
    *   `UPDATE` on `messages` (Solved status).
    *   `UPDATE` on `games` (Mode switching).

### C. Mobile/PWA Specifics
*   **Manifest:** Include `manifest.json` for installability.
*   **Viewport:**
    *   Do not rely on `100vh`. Use `dvh` (Dynamic Viewport Height) or JavaScript window resize listeners to calculate the container height.
    *   Input field: Ensure `scrollIntoView` is called when input focuses.

## 8. Step-by-Step Implementation Plan for AI

1.  **Setup:** Initialize Next.js + Supabase. Create `lib/gameConfig.ts`.
2.  **Database:** Run SQL to create tables based on the schema above.
3.  **Auth/Profile:** Build Settings page and Profile logic.
4.  **Lobby:** Build Game Creation and Listing.
5.  **Game Logic (Chat):** Implement sending messages and the "Cipher" visual component (only show text if it's the very last message).
6.  **Game Logic (Solve):** Implement the reverse logic.
    *   *Crucial:* CSS logic for `flex-direction: column-reverse` vs standard column depending on mode.
7.  **AI Integration:** specific Edge Function for Gemini hints.
8.  **Testing:** Build the `/test-playground` and verify Streak/Score logic.
9.  **UI Polish:** Dark mode, PWA manifest, Mobile keyboard handling.