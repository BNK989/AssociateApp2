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
- [ ] add a chime for when its the players turn (use one chime for when the player is in the game and another when theyre not i.e. in the lobby or in another tab)
- [ ] add end screen to the game - once a game is over show the end popover

## Phase 5: fix dark and light mode support
- [ ] from the settings panale make sure the dark and light mode is saved and applied
- [ ] make sure the dark and light mode is applied to the game page and the homepage
- [ ] change favicon to show (it currently shows the nextJS favicon)

## Phase 6: Score & Streaks
- [ ] confirm points logic 
- [ ] ui for points and streaks
- [ ] add points to the game
- [ ] add streaks to the game
- [ ] add leaderboard to the game

## Phase 7: Game Loop - Solving UI improvements (Phase 2)
- [ ] Only allow hints to the player whos turn it is (once were in free for all mode anyone can get a hint)
- [ ] Solving Interaction
- [ ] Score Calculation & Streaks


## Phase 8: AI & Polish
- [ ] PWA Configuration (Manifest, Service Worker)
- [ ] `/test-playground` Implementation
