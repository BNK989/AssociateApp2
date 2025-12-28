# Gamemaster Guide: Uploading Daily Games

This guide explains how to upload new Daily Challenges to the `daily_games` table in Supabase.

## Table Structure

The `daily_games` table has the following columns:

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Unique ID (auto-generated) |
| `play_date` | `date` | The date the game is played (YYYY-MM-DD). Must be unique. |
| `words` | `jsonb` | JSON Array of strings containing the word chain. |
| `theme` | `text` | **(New)** A short subject or title for the chain (e.g. "Space", "Mechanics"). |
| `created_at` | `timestamptz` | Auto-generated timestamp. |

## Word Chain Format

-   **Order**: The words should be ordered from **Start** to **End**.
-   **Gameplay Logic**: The **Last Word** in the array is revealed to the player first. The player then guesses the word immediately *before* it, working their way up to the first word.
-   **Example**:
    -   Chain: `Cloud` -> `Rain` -> `Water` -> `Ocean`.
    -   Theme: `Nature`
    -   Array: `["Cloud", "Rain", "Water", "Ocean"]`
    -   Player sees: `Ocean`. Guesses `Water`. Then `Rain`. Then `Cloud`.

## uploading via SQL Editor (Supabase Dashboard)

You can run the following SQL command in the Supabase SQL Editor to insert games for upcoming dates.

### Template

```sql
INSERT INTO public.daily_games (play_date, words, theme)
VALUES
    ('YYYY-MM-DD', '{"Word1", "Word2", "Word3", "Word4", "Word5"}', 'Theme Name');
```

### Bulk Insert Example

```sql
INSERT INTO public.daily_games (play_date, words, theme)
VALUES
    -- Monday
    ('2025-01-01', '{"Morning", "Coffee", "Bean", "Stalk", "Jack", "Giant"}', 'Fairytales'),
    -- Tuesday
    ('2025-01-02', '{"Space", "Star", "Light", "Bulb", "Idea", "Brain"}', 'Bright Ideas'),
    -- Wednesday
    ('2025-01-03', '{"Apple", "Pie", "Chart", "Graph", "Line", "Draw"}', 'Art Class')
ON CONFLICT (play_date) DO UPDATE
SET words = EXCLUDED.words, theme = EXCLUDED.theme;
```

> **Note**: The `ON CONFLICT (play_date) DO UPDATE` clause ensures that if a game already exists for that date, it will be updated with the new words instead of failing.

## Validation

1.  **Check Data**:
    ```sql
    SELECT * FROM public.daily_games ORDER BY play_date DESC;
    ```
2.  **Test Client**:
    -   Set your computer's date to the target date (or wait until then).
    -   Visit `/daily`.
    -   Verify the chain loads and the last word is the one revealed.

## Best Practices

1.  **Chain Length**: 5-7 words is the recommended "sweet spot" for a daily challenge.
2.  **Difficulty**: Start with the last word being a concrete noun. Abstract concepts in the middle are harder.
3.  **Ambiguity**: Ensure connections are strong. Avoid links that are too personal or obscure.
