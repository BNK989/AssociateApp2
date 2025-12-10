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
- [x] update the database to support game status played also change 'LOBBY' status to 'TEXTING'
- [x] at the end of a game (i.e. when all the messages have been guessed) show a popover with statistics about the game 
- [x] add to the end of the game some effects like confetti to indicate the game was successfully played

## Phase 5.5: fix dark and light mode support
- [x] from the settings panale make sure the dark and light mode is saved and applied
- [x] make sure the dark and light mode is applied to the game page and the homepage

## Phase 6 - invite improvements
- [x] improve invitation system to allow inviting people who are not yet registered (share an invitation link to the game - the invitee will be added to the game when they register or login)
- [x] when a game is created the user should be encouraged to invite people to the game

## Phase 6.5: notifications improvement
### to better handle normal user behavior (i.e. users swiching tabs or windows, looking away from the screen etc.) we need to better handle notifications
- [x] add a system notification to notify the player when its their turn even if they are not in the game (i.e. they are in another tab or window) handle this gracfully as user preferences may not allow notifications also allow the user to disable this feature in the preferences page
- [x] add a chime to notify the player when its their turn even if they are not in the game (i.e. they are in another tab or window) the file `chime1.mp3` is provided
- [x] change the tab's title back and forth to notify the player when its their turn even if they are not in the game

## Phase 7: Score & Streaks & Hints
- [x] create a file with all score logic for easy reference and adjustments (include multiplier logic and points logic)
- [x] confirm points logic 
- [x] ui for points and streaks
- [x] add points to the game
- [x] add streaks to the game
- [x] implement hint1 show first letter, hint2 randomly expose 50% of the messages, hin3 get an AI hint
- [x] implement end game screen - show relevant statistics from game score and streaks about the game and include plays scores 
- [x] implement hint3 via AI API (Gemini 2.5 Flash-Lite see the key in the use key from env file under GEMINI_KEY) include

## Phase 8: versitilty of gmaemaster  
- [ ] create a file within the code to document and control all the variables used in the game such as time to confirm solve, time before free for all etc. you can start with just these and as we'll carry on developing we'll add additional variable
-   [ ] to protect the gemini API from abuse lets create a limitation of 5 hints per game per player and no more than 100 per IP per day  - keep these variables in the variable file include logs and alarts for when abused.


## Phase 8.5: reliability and improvements for QA  
- [ ] Interduce test for core functionallity - create an md file to help new developers understand how and when to run them
- [ ] add to the schema at supabase an option to mark a player as an admin (this should be done via supabase by manually manipulating the database)
- [ ] add admin powers so admins can inspect any game and anymessage
- [ ] to each created game create a handle, used like similar to an id later on we'll use this handle in the url instead of the id to navigate and show it on the gmae name 

## Phase 9: Solving UI improvements
- [ ] Only allow hints to the player whos turn it is (once were in free for all mode anyone can get a hint)
- [ ] Solving Interaction
- [ ] improve the homepage 
-   [ ] add skeltons (from shadcn) to the homepage 
-   [ ] improve game gamecards in the hompage to include total messages sent, last activity e.g. "last move 3 hourse ago" remove the timestamp
-   [ ]  add to the gamecards CTA of play now / continue solving 
-   [ ]

## fixes
- [ ] when a guess is correct there should not be a toast alert
- [ ] re-add the ::[cipher]:: (dubble colon format) for the cipher appears in the chat (no hints given) to better indicate that the user is viewing the cipher and not the message
- [x] add notifications to the game - so that players are notified when its their turn and keeps them engaged 

## additions and do later
- [ ] add a way for the user to upload their own avatars - supabase storage (scale the image down to 256x256 on the client side before uploading)
- [ ] in the notification center (bell icon)add dismiss all option 
- [ ] add leaderboard to the game
- [ ] add skeltons or a game loader for when a game is loading 
- [ ] add NextStep.js to the project to aid in onboarding 
- [ ] using supabase mcp - when a game is archived or complited keep it for 72 hours and then delete it 
- [ ] improve the pre-login screen create a better login experience by intreducing the game for unregistered users
- [ ] create a demo mode where a user can play the game without logging in 

## Phase 9: Cloud Functions & storage management
- [ ] add cloude functions via supabase to archive a game after 72 hours of no play (using mcp)
- [ ] add cloude functions via supabase to delete a game after 7 days of it being archived (using mcp)

## Hits

## Phase 8: AI & Polish
- [x] PWA Configuration (Manifest, Service Worker)
- [ ] `/test-playground` Implementation
- [ ] allow users to connect their whatsapp account to recive notifications when via the game such as 'its your turn to play + link to the game' or 'game started + link to the game' etc.
