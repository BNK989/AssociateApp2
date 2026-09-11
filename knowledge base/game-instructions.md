# How to Play: Classic & Daily

Welcome to Associate! A word association game designed to test how well you know each other and how quickly you can think.

## 🎮 Classic Mode
*Multiplayer | Real-time*

In **Classic Mode**, you play with friends in two distinct phases.

### Phase 1: Texting 💬
1.  **Associate**: Players take turns sending single-word messages.
2.  **Build a Chain**: Each word should be associated with the previous one.
    *   *Example*: `Coffee` -> `Morning` -> `Sun` -> `Star` -> `Wars`...
3.  **Encrypted**: As you type, your messages are hidden (encrypted). You can only see the length of the words sent by others.

### Phase 2: Solving 🕵️‍♀️
Once the message limit is reached or the players agree to switch:
1.  **Guess Backwards**: The game flips to "Solving Mode".
2.  **The Goal**: You must guess the messages that were sent, starting from the last one and working backwards to the first.
3.  **Turn-Based**: The active player has **20 seconds** to guess their own word (or the word assigned to them).
4.  **Free-For-All**: If the timer runs out, it becomes a free-for-all! Anyone can steal the point by guessing the word.
5.  **Hints**: Stuck? You can buy hints (costs points):
    *   💡 **1st Hint**: See word length.
    *   💡 **2nd Hint**: Reveal 25% of letters.
    *   💡 **3rd Hint**: Get an AI-generated clue.

---

## 📅 Daily Challenge
*Single Player | Daily Puzzle*

A new unique puzzle drops every day!

1.  **The Chain**: You are presented with a pre-set chain of associated words.
2.  **Reverse Engineering**: The **last word** of the chain is revealed to you.
3.  **Your Mission**: Guess the word that came *before* the revealed word.
4.  **Climb the Chain**: Each correct guess reveals the next hidden word. Keep going until you reach the start of the chain!
5.  **Streaks**: Build a consecutive correct guess streak for bonus points.
6.  **Global Leaderboard**: Compete with players around the world for the highest score on today's chain.

---

## Reading a partly-revealed word

As you guess and buy hints, letters start showing through the mask. Each colour
says exactly one thing:

*   **Green** — confirmed in place. This letter belongs exactly here.
*   **Orange** — the letter is in the word. You have found it.
*   **Grey** — still hidden. A placeholder symbol, not a letter.

Orange never tells you where a letter *isn't*. Below the shuffle hint, revealed
letters are shown where they belong; from the shuffle hint onward the letters
are rearranged, their order stops being a clue, and the drifting tiles are the
ones still to place. The key is always available from the palette button beside
the input.

---

## When a word does not come

Three things exist so that a word you cannot get is a pause rather than an exit.

*   **Near misses are forgiven once per word.** A guess close enough in
    *spelling* — not meaning; the measure is Levenshtein and knows nothing about
    associations — costs no strike the first time. The acceptance threshold is a
    ratio, so one wrong letter is waved through on a nine-letter word and fatal
    on a three-letter one; this evens that out. The second near miss on the same
    word is charged, so it cannot be walked one letter at a time toward the
    answer.
*   **Open the other end** lets you attack the chain from its start. The chain
    is strictly pairwise — each word associates with the one after it — and play
    runs backwards from the free final word, so the word *after* the one you are
    guessing is the only thing you have to reason from. That makes a word you
    cannot get a wall rather than a detour. This gives you the chain's first
    word instead, the one word with no predecessor and therefore the only other
    place the chain can be entered. From there you guess forwards, the two
    fronts converge, and the word that stopped you ends up between two
    neighbours you know. It costs that first word — nothing scored, white on the
    grid — and can be done once per chain.
*   **Reveal** shows you the word and moves the chain on. It was "Give Up",
    styled in red behind a flag, which is a strange way to dress the only route
    past a word you do not know. Nothing about the move changed — it still
    scores nothing — but it is no longer presented as a defeat.
*   **The streak decays; it does not collapse.** A wrong guess costs it nothing
    at all (the word carries its own strikes). A word that leaves unsolved —
    revealed or struck out, treated identically — costs one step. Five solves
    deep and you reveal one, you are on four: still within reach of the bonus,
    which is the point.

---

## 🏆 Scoring

*   **Correct Guess**: Points based on word difficulty and length.
*   **Speed Bonus**: Faster answers get more points.
*   **Streak Bonus**: Consecutive correct answers multiply your score.
*   **Hint Penalty**: Using hints reduces the potential points for that word.

## ⚠️ Limitations

*   **AI Hints**: Using the 3rd hint (AI-generated) is subject to availability and usage limits (5 per game, 100 per day per IP). Guest users do not have access to AI hints.
*   **Connection Score Indicator**: The UI element showing the strength of the link between words (e.g., "Loose Link", "Strong Link") in the Daily Game has been temporarily hidden via CSS based on user feedback to streamline the visual experience.