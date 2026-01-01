# Daily Game Performance Dashboard Setup

This guide explains how to set up a PostHog dashboard to monitor the performance and engagement of the Daily Game.

## 1. Overview
We track three key events to understand user behavior:
- `daily_game_entered`: When a user opens the daily game.
- `daily_word_solved`: When a user solves a word.
- `daily_game_completed`: When a user finishes the daily challenge.

## 2. Creating the Dashboard

1. Log in to PostHog.
2. Go to **Dashboards** and click **New Dashboard**.
3. Name it "Daily Game Performance".
4. Add the following insights:

---

### Insight A: Daily Entrances (Traffic)
*Understand how many users are playing each day and split by user type.*

1. **Insight Type**: specific "Cards" (or just "Trends").
2. **Series**:
   - Event: `daily_game_entered`
3. **Breakdown by**: `user_type` (registered vs guest).
4. **Display**: Line Chart.
5. **Name**: "Daily Entrances by User Type".

---

### Insight B: Daily Completion Rate (Funnel)
*See what percentage of players finish the game.*

1. **Insight Type**: Funnel.
2. **Steps**:
   - Step 1: `daily_game_entered`
   - Step 2: `daily_game_completed`
3. **Breakdown by**: `user_type` (Optional, to see if registered users finish more often).
4. **Name**: "Daily Game Completion Funnel".

*Note*: This shows the global completion rate. To see it for a specific daily game, filter by `date`.

---

### Insight C: Words Solved Per Session
*Analyze how deep users get into the game if they don't finish.*

1. **Insight Type**: Trends.
2. **Series**:
   - Event: `daily_word_solved`
   - Math: Total Count or Average per user.
3. **Breakdown by**: `word` (To see which words are solved most often - identifies "easy" vs "hard" days).
4. **Name**: "Words Solved Distribution".

---

### Insight D: Average Score
*Monitor the difficulty of the daily games.*

1. **Insight Type**: Trends.
2. **Series**:
   - Event: `daily_game_completed`
   - Property: `final_score`
   - Math: Average.
3. **Name**: "Average Completion Score".

## 3. Filtering by Date
All events define a `date` property (e.g., `2023-10-27`).
- To analyze a specific daily puzzle, add a global filter to the dashboard: `Property 'date' equals 'YYYY-MM-DD'`.
