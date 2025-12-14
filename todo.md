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
- [x] create a file within the code to document and control all the variables used in the game such as time to confirm solve, time before free for all etc. you can start with just these and as we'll carry on developing we'll add additional variable
-   [x] to protect the gemini API from abuse lets create a limitation of 5 hints per game per player and no more than 100 per IP per day  - keep these variables in the variable file include logs and alarts for when abused.


## Phase 8.5: reliability and improvements for QA  
- [x] add to the schema at supabase an option to mark a user as an admin (this should be done via supabase by manually manipulating the database)
-   [x] add admin powers so admins can inspect any game and anymessage
-   [x] add admin powers so that admins can get a context menu (shadcn) to perform actions on any game or message like get hint1/2/3 or delete a message or a game, view it when cipher is showing etc.
-  [x] add an option to reset game - so that all the messages are ciphered and the game is reset to the initial state (i.e. the messages have been sent and the game is in texting mode)
- [x] Interduce tests for core functionallity - create an md file to help new developers understand how and when to run them

## Phase 8.6: UI improvements
- [x] add skeltons (shadcn) for when the homepage is loading 
- [x] add a loading screen for when a game is loading (use animations especially if its a new game)
- [x] add the app icon to the left of the app name in the header
- [x] add an animation for when the game is switched to solve mode - this should be short and celebratory

## Phase 9: game logic and game modes
- [x] Disallow same message in a specific game (i.e. the same message cannot be sent twice) this is so that players don't send the same assosication over and over again. make sure to handle this gracefully and show a toast alert to the player
- [x] limits on message length to max 25 characters (set in the gameConfig file) handle gracefully
- [x] create a game mode popup at game creation to allow the game creator to limit the total messages in a game (e.g. 25, 50, 100 messages, set options as array in the gameConfig file also naming each option, e.g. short, medium, long, very long), once the game hit this limit it should switch to solving mode, players can still be able to manually switch to solving mode 
- [x] add "start random button" in initial empty game - this should start with a random message if no messages have been sent (from top 250 most common words in english)
- [x] when no messages have yet been sent (new game) allow any user to send a message and therby start the game
- [x] Only allow hints to the player whos turn it is (once were in free for all mode anyone can get a hint)

- [x] create backup for the supabase data structures and functions

## Phase 10: improve the homepage gamecards
-   [x] include total messages sent of total messages limit (by game mode e.g short 25, medium 50, long 100)
-   [x] include last activity indicator e.g. "last move 3 hourse ago" . the timestamp should be removed and only visible on hover
-   [x] keep the game status indicator (e.g. "texting", "solving", "completed")
-   [x] keep the players avatars (make sure to properly handle the case where there are too many players the ui should handle this gracefully)
-   [x] keep the turn indicator (e.g. "your turn")
-   [x] change the game id to a handle (e.g. "shortgame-1" or "longgame-1"), later on we'll use this handle in the url instead of the id to navigate and show it on the gmae name 
-   [x] add to the gamecards CTA like resume texting / continue solving (if completed show view game)

## Phase 11: Cloud Functions & storage management
- [x] add cloude functions via supabase to archive a game after 72 hours (set in gameConfig.ts) of no play (using mcp)
- [x] add cloude functions via supabase to delete a game after 7 days (set in gameConfig.ts) of it being archived (using mcp)

# pre-launch
- [ ] add analytics to the game, KPIs
- [ ] review code to ensure it is secure and follows best practices pre-launch
- [ ] 

## post-launch
- [ ] 

## fixes
- [ ] when a guess is correct there should not be a toast alert
- [ ] re-add the ::[cipher]:: (dubble colon format) for the cipher appears in the chat (no hints given) to better indicate that the user is viewing the cipher and not the message
- [ ] fix the admin get hints option to work 
- [ ] when game is generated sometimes the create game button does not work, the create button is stuck, after selecting game type (i.e short, medium etc.) - fix this
- [ ] the encription/decreption effect is not working - fix this when a message is encrypted or decrypted is should change mode letter by letter 
- [x] add notifications to the game - so that players are notified when its their turn and keeps them engaged 
- [x] UI: the x button on toast notifications appear complitly black in hover mode, fix this
- [x] bug: the placeholder text in the input field does not update as quickly (to indicate that the turns have switched)

## additions and do later

- [ ] add a way for the user to upload their own avatars - supabase storage (scale the image down to 256x256 on the client side before uploading)
- [ ] after exosting the hints change the hint button to a giveup button to allow users to just get the word for no points (reset the streak counter)
- [ ] in the notification center (bell icon) add dismiss all option 
- [ ] add leaderboard to the game
- [ ] add NextStep.js to the project to aid in onboarding 
- [ ] improve the pre-login screen create a better login experience by intreducing the game for unregistered users
- [ ] create a demo mode where a user can play the game without logging in 
- [ ] add i18n to the game (support hebrew, english, german and spanish) - make sure all the game UI is RTL and LTR compatible by the users language
- [ ] three dots while other user is typing (peer to peer)


## Hits

## Phase 8: AI & Polish
- [x] PWA Configuration (Manifest, Service Worker)
- [ ] `/test-playground` Implementation
- [ ] allow users to connect their whatsapp account to recive notifications when via the game such as 'its your turn to play + link to the game' or 'game started + link to the game' etc.
