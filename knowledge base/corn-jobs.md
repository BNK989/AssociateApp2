# Knowledge Base

## Game Management

### 1. Player Archival (User Action)
When a player clicks "Archive Game":
*   **Purpose**: To hide the game from their own lobby view.
*   **Scope**: Individual. Affects only the user who clicked it.
*   **Mechanism**: Updates `game_players.is_archived = true` for that specific user.
*   **Database**: Does NOT affect the `games` table or `games.status`.

### 2. System Cleanup (Automated)
The system automatically manages old or inactive games to keep the database clean.
*   **Purpose**: To retire inactive games and delete very old data.
*   **Logic**:
    *   **Auto-Archive**: If a game has been inactive for > 72 hours, its status is set to `archived` and `games.archived_at` is set to the current timestamp.
    *   **Auto-Delete**: If a game has been `archived` for > 7 days, it is permanently deleted.

---

## Guest Management

### Guest Cleanup (Automated)
The system automatically removes temporary guest accounts to prevent database bloat.
*   **Purpose**: Delete anonymous users who haven't converted to full accounts.
*   **Logic**:
    *   Finds users where `is_anonymous = true`.
    *   Checks if `created_at` was more than **24 hours ago**.
    *   **Permanently Deletes** the user from `auth.users`.
    *   **Cascade**: Automatically deletes all related data (profiles, messages, game_players) via database constraints.

---

## System Automation (Gamemaster Reference)

The system relies on Postgres Cron Jobs (`pg_cron`) running in the background.

| Job Name | Schedule | Action | Description |
| :--- | :--- | :--- | :--- |
| `daily-cleanup` | `0 3 * * *` (3:00 AM) | `SELECT cleanup_games_logic()` | Archives inactive games (>72h) and deletes old ones (>7d). |
| `delete-guest-users` | `0 4 * * *` (4:00 AM) | `SELECT delete_expired_guests()` | Deletes anonymous guest accounts older than 24 hours. |

### Verification Instructions

**1. Check Scheduled Jobs**
Run this to confirm jobs are active and scheduled correctly:
```sql
select * from cron.job;
```

**2. Check Execution Logs**
Run this to see the history of automatic runs (success/failure):
```sql
select 
  j.jobname,
  r.status,
  r.start_time,
  r.return_message
from cron.job_run_details r
join cron.job j on r.jobid = j.jobid
order by r.start_time desc 
limit 10;
```

**3. Manual Test Run**
You can manually trigger the logic at any time to verify it works or to see immediate results.
*These manual runs do NOT appear in the cron logs.*

*   **Test Game Cleanup:**
    ```sql
    SELECT cleanup_games_logic();
    ```
    *Expect return:* `"Archived: X games, Deleted: Y games"`

*   **Test Guest Cleanup:**
    ```sql
    SELECT delete_expired_guests();
    ```
    *Expect return:* `void` (No output means success. If it fails, it will show an error).
