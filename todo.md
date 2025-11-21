# Project Todo List

## Phase 1: Setup & Config
- [ ] Initialize Next.js + Tailwind CSS + TypeScript
- [x] Setup Supabase Client & Environment Variables
## Phase 4: Game Loop - Creation (Phase 1)
- [x] Chat Interface
- [x] Message Ciphering Logic
- [x] Turn Management
- [x] Realtime Updates (Supabase)

## Phase 4.5: game improvements for scale handleing
- [x] in the homepage only show games that the player is in
- [x] add to each game in the homepage a notification badge to notify the player when its their turn
- [x] support game archive and delete, and leave game where a player can leave half way through a game (this may require a new game states) access this new option via shadcn context manu
- [x] when a message was guessed incorrectly add a shake effect to the message to indicate the guess was wrong

## Phase 5: end game popover
- [ ] update the database to support game status played also change 'LOBBY' status to 'TEXTING'
- [ ] at the end of a game (i.e. when all the messages have been guessed) show a popover with statistics about the game 
- [ ] add to the end of the game some effects like confetti to indicate the game was successfully played

## Phase 5.5: fix dark and light mode support
- [ ] from the settings panale make sure the dark and light mode is saved and applied
- [ ] make sure the dark and light mode is applied to the game page and the homepage
- [ ] change favicon to show (it currently shows the nextJS favicon)

## Phase 6: Score & Streaks & Hints
- [ ] confirm points logic 
- [ ] ui for points and streaks
- [ ] add points to the game
- [ ] add streaks to the game
- [ ] add leaderboard to the game
- [ ] implement hint1 show first letter, hint2 randomly expose 50% of the messages, hin3 get an AI hint

## Phase 7: Game Loop - Solving UI improvements (Phase 2)
- [ ] Only allow hints to the player whos turn it is (once were in free for all mode anyone can get a hint)
- [ ] Solving Interaction
- [ ] Score Calculation & Streaks

## fixes

## additions and do later
- [ ] add dismiss all for notifications 
- [ ] add a chime for when its the players turn (use one chime for when the player is in the game and another when they're not in the gameroom i.e. in the lobby or in another tab)
- [ ] add skeltons to the homepage 

## Hits

## Phase 8: AI & Polish
- [ ] PWA Configuration (Manifest, Service Worker)
- [ ] `/test-playground` Implementation
