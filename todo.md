# Project Todo List

## Phase 1: Setup & Config
- [x] Initialize Next.js + Tailwind CSS + TypeScript
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

## Phase 12: Site Footer
- [x] add site footer in all pages (except game page). the footer should include,
    - [x] our all rights reserved
    - [x] privacy policy
    - [x] terms of service
    - [x] feedback form shadcn (use supabase to store feedback & cloud function to send email to admin)
    - [x] special thank you page
    **all pages should have a simple HTML structure to allow our webmaster to update the content easily**

# Pre-launch

### user feed back (Gerrit)
- [x] remove solved toast
- [x] when starting to solve provide instructions: "You started solve mode, try to guess the messages"
- [x] change countdown at the end of the game i.e. last 3 messages to send 3 2 and last message, now it start to count 2 messages before the end but it should 3 messages before the end i.e. the "last message" should allow the last player to send the last message
- [x] cancel toast message after invite is sent (in the game > invite > click on player name)
- [x] add share button to end screen to allow user to share theie results and thereby share the game with others

### when a message is solve by a player who's not the author
- [x] add a "steal" animation that zooms across the bottom of the screen with the avatar and name of the player who solved it
- [x] show each player the points they earned, for solving the message and the assist bonus if any (currenty there seems to be an issue where both author and the solver see the same points) no need to change the animation here, just the number of points should be different for each player

## phase 13: once a player left the game
- [x] in texting mode let remininlg players carry on texting
- [x] in solve mode the author of the message is not in the game allow free for all imidiatly
- [x] when trying to switch to solve only verify the switch with active players 

## phase 14: define player leaving the game
- [x] player can leave the game by using the context menu (existing functionality).
- [x] when a player leaves the game show a system notification in the chat "player [player-name] left the game" and remove their turn and avatar from the game top bar (keeping messages they've sent) and allowing other players to continue texting
- [x] in guessing mode when the messsage author has left the game simply allow free for all imidiatly
- [x] when a player clicks back at the top of the game page IN AN ACTIVE GAME show a dialog to confirm if they want to leave the game e.g. leave the game? you will not be able to return to this game 
- [x] add a system notification also when players join the game i.e. "player [player-name] joined"
- [ ] add an option to remove a player from the game by other active players: once a player is not responding a long time (set in gameConfig.ts), allow other active players to remove a non-responding player e.g., "[player-name] has not responded for [xx], you can remove them from the game to continue playing" then similar to how we confirm to switch to solve mode we should confirm the player removal by promting all the users to confirm the action (counting 10 seconds then auto confirming). as when a player leaves by themselve,add a system notification in the chat "player [player-name] was removed"

## Phase 15: game info screen (popup)
- [x] add a game info screen that opens when clicking on the game header in the game room (clicking anywhere other than the back button)
- [x] score info on the top of the screen
- [x] players info in the game; including their avatar and name
- [x] allow quick return to game
- [x] add a info icon in this screen that opens the a popup with game rules and instructions


## Phase 16: 
- [ ] add restriction for guest users to not be able to use any AI features (hint #3)
- [ ] limit number of active games a user can have set limit in gameConfig.ts to 10 if a player has reached this limit show popup alert letting them archive games and prevent them from creating a new game. this needs to be handled gracefully to prevent the user from being stuck
- [ ] rename the current homepage to lobby (i.e. /lobby) and add a new homepage that show the current active games and a CTA to create a new game (i.e. /) after a user log in move them to the lobby page
- [ ] create an option for free chatroom, where a player can create a game and invite anyone to join, the game is then published to the lobby where anyone can join it (up to 5 players set in gameConfig.ts)

## Phase 17: posthog events & review and KPIs
- [ ] add posthog events for game status change (e.g. texting, solving, completed, archived, deleted)
- [ ] proffesional code reviewer to check site reliability and security
- [ ] add analytics to the game, KPIs
- [x] get domain name associ8game.com/
- [x] get ssl certificate
- [x] add a way for users to provide feedback and logs on the game

## Phase 17.6: db corn job verification
- [x] check corn job is running and verify it is running correctly cleanning old games and guest users - **Gamemaster Reference: at corn-jobs.md**

## Phase 18: mid turn events 
### new logic, while its not the player's turn, to keep the player engaged, let them guess the next message and if they guess correctly, they get a bonus point and some confetti animation


## Phase 19: - Adding SEO to the game
- [x] add meta tags to the game
- [x] add title to the game
- [x] add description to the game
- [x] add keywords to the game
- [x] add Open Graph tags to the game
- [x] add Twitter Card tags to the game

## Phase 19.5: marketing
- [ ] add subscibe for email updates
- [ ] add social media links
- [ ] add social media sharing


# new feuture: daily challenge - to get players hooked
each day the gamemaster would upload a daily chain (lets say of 25 messages) the players would get the list and go into the game in solve mode, where they have to guess back the words one by one. 
example chain: engineering, design, blueprint, component, part, fastener, bolt, screw, rivet, tool, wrench, mechanism, gear, sprocket, axle, bearing, cam, spring, lever, pulley, valve, cylinder, piston, crankshaft, engine, turbine, chassis, circuit, robot, automation, assembly, fabrication, maintenance, repair, inspection

----------------

## fixes
- [ ] improve layout on mobile - messages scroll out of view (Gerrit reported via iphone)
- [ ] fix the admin get hints option to work 
- [ ] when game is generated sometimes the create game button does not work, the create button is stuck, after selecting game type (i.e short, medium etc.) - fix this
- [ ] when resuming a game in solve mode there is a toast message letting you know your in solve mode - this is unneccessary and shoule not appear (it happends after a resuming player send a guess)
- [x] when an invitation is sent via share link the exepting user (checked for logged in guest user) get stuck on "Checking credentials ... Please wait while we connect you to the game ..." - fix this
- [x] when a guess is correct there should not be a toast alert
- [x] the encription/decreption effect is not working - fix this when a message is encrypted or decrypted is should change mode letter by letter 
- [x] add notifications to the game - so that players are notified when its their turn and keeps them engaged 
- [x] UI: the x button on toast notifications appear complitly black in hover mode, fix this
- [x] bug: the placeholder text in the input field does not update as quickly (to indicate that the turns have switched)
- [ ] ~~re-add the ::[cipher]:: (dubble colon format) for the cipher appears in the chat (no hints given) to better indicate that the user is viewing the cipher and not the message~~

## additions and do later
- [ ] guestmode: for guest sign up we'll need to add captcha to the sign up form
- [ ] find a way to keep the player more engaged during the game, the issue is mostly while the players are waiting their turn  
- [ ] update stealAnimation.tsx to be more flexible and allow for different types of messages to be animated we can call it zoomAnimation.tsx
- [ ] after exosting the hints change the hint button to a giveup button to allow users to just get the word for no points (reset the streak counter)
- [ ] add leaderboard to the game
- [ ] add i18n to the game (support hebrew, english, german and spanish) - make sure all the game UI is RTL and LTR compatible by the users language
- [ ] add nudge button (think if we need it in game of more of a sevice that'll send a notification to the user)
- [ ] `/test-playground` Implementation
- [ ] allow users to connect their whatsapp account to recive notifications when via the game such as 'its your turn to play + link to the game' or 'game started + link to the game' etc.
- [x] add onboarding for new users 
- [x] create a demo mode where a user can play the game without logging in 
- [x] in the notification center (bell icon) add dismiss all option 
- [x] add a way for the user to upload their own avatars - supabase storage (scale the image down to 256x256 on the client side before uploading)
- [x] improve the pre-login screen create a better login experience by intreducing the game for unregistered users
- [x] three dots while other user is typing
- [x] improve "encryption" so that the message length is not visible to the user
- [x] guestmode: when a guest logs out or after 24 hours remove them from the database (cascade delete)
