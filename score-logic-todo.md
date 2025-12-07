# Associate Game 2.0 - "The Bank & Heist"

## Backend & Business Logic (Developer To-Do)
### Core Scoring Engine
[x] Implement Base Message Valuation: Create a function to calculate the value of a new message using the formula: 10 points + 1 point per character.

[x] Implement "Team Pot" Accumulator: Ensure message values are added to a shared "Team Pot" or "Total Potential Score" rather than individual scores immediately.


[x] Implement "Fuzzy Matching" Algorithm: Create a validation check that accepts guesses with >80% similarity to the target word, applying a slight point reduction for imperfect matches.

[x] Implement "Strike" System: Track wrong guesses per word; if 3 wrong guesses occur, set the word value to 0 and remove it from the stack/pot.

Point Distribution & Payouts
[x] Develop "Self-Rescue" Logic: If guesser_id == author_id, award 50% of the word's value to the player.

[x] Develop "The Steal" Logic: If guesser_id != author_id, award 75% of the value to the guesser and a 25% "Assist Bonus" to the author.

[x] Create "Assist Bonus" Crediting: Ensure the author receives their cut even if their word is stolen to maintain engagement.

### Economy & Hints
[x] Implement Hint Cost Logic: Ensure hint costs are deducted from the specific word's potential reward, not the player's banked score.

[x] Build Hint Tier 1: Reveal the first letter of the message for a cost of 10% of the word's value.

[x] Build Hint Tier 2: Reveal 40% of all the letters in the message (randomly) for another cost of 10% of the word's value.

[x] Build Hint Tier 3 (AI): Trigger an AI hint for a cost of 40% of the word's value.


### Multipliers & Streaks
[x] Track Individual "Hot Hand" State:

2 correct in a row: Set multiplier to 1.2x.

3 correct in a row: Set multiplier to 1.5x.

4+ correct in a row: Set multiplier to 2x.

Any wrong guess: Reset individual multiplier to 1x.

[x] Track Team "Flow" State: Increment a global counter for every correct guess by any player.

[x] Implement "Fever Mode" Trigger: When the team counter hits the threshold (e.g., 5), double all points for the next 3 words.

[x] Handle Penalty Logic: On a wrong guess, do not deduct points from the total score, but trigger the multiplier reset.



### GUI & Frontend Requirements
#### HUD & Visual Feedback - this should be at the top center of the chat, next to the players avatars. 

[x] Display "Total Potential Score": Show a locked "Bank" score that represents the total value of the current pot to create tension. 

[x] Visualizer for Multipliers: Display an icon or indicator when a player is "in the zone" (Hot Hand) to show they are carrying the team.

[x] Team "Flow" Meter: Display a progress bar that fills up with correct guesses to indicate progress toward "Fever Mode".

[x] Fever Mode UI: Create a distinct visual state (e.g., color change, particles) when Fever Mode is active for the 3-word duration.

[x] for every solved message show a count of how many points it awarded the player (including the multiplier if any)

### Interactive Elements
[x] add to the existing hint button an inducation of the hint cost and stage (which of 3 hints it is Level 1, 2, or AI)

### Feedback Messages
[x] Differentiation of Points: Visually distinguish between points earned via "Self-Rescue" vs. "The Steal" vs. "Assist Bonus" when awarding score.

[x] Strike Indicator: Visually represent the number of wrong guesses (strikes) on a specific word card.

[x] Word Lost Notification: If a word hits 3 strikes, play an animation showing the word evaporating or being removed with 0 points awarded.