// lib/gameConfig.ts
export const GAME_CONFIG = {
  MAX_PLAYERS: 5,
  MESSAGE_WORD_LIMIT_MIN: 1,
  MESSAGE_WORD_LIMIT_MAX: 3,
  POINTS_PER_SEND: 1,
  POINTS_PER_SOLVE: 100,
  STREAK_THRESHOLDS: [3, 5, 10], // Bonus tiers
  STREAK_BONUS_MULTIPLIER: 1.5,
  GUESS_TIMEOUT_SECONDS: 10, // Time before specific turn becomes free-for-all
  GAME_MODE_100_LIMIT: 100,
  AI_HINT_MODEL: "gemini-flash-lite-latest", // Updated to latest alias (supports gemma-4-26b-a4b-it / gemini-flash-lite-latest)
  AI_HINT_BACKUP_MODEL: "gemini-flash-latest",
  SOLVE_PROPOSAL_TIMEOUT_SECONDS: 10, // Time to confirm solve
  SOLVING_MODE_DURATION_SECONDS: 10,  // Time for solving phase
  // Rate Limits
  AI_HINT_LIMIT_PER_GAME_PLAYER: 5,
  AI_HINT_LIMIT_PER_IP_DAY: 100,
  MESSAGE_MAX_LENGTH: 25,
  // Cleanup Timers
  GAME_ARCHIVE_HOURS: 72,
  GAME_DELETE_DAYS: 7,
  ENABLE_TYPING_INDICATORS: true,
  DAILY_GAME_ANIMATE_START_MESSAGE: true,
  PERCENT_REVEALED_SHUFFLE_HINT: 0.66,
  // Auto Hint Defaults
  //
  // Off by default since 2026-09-13. `stuckSignals.ts` states the rule the
  // whole stuck-player effort rests on — *the game offers, the player never
  // asks* — and the auto-hint clock did neither: it took the rung on the
  // player's behalf and charged full price for it. On the old defaults a
  // player who simply thought about a word for a minute was walked to level 3,
  // docked 60% of the word, and given a permanent yellow square on the share
  // grid, none of which they asked for. Thinking time is not a hint request.
  //
  // Nothing is removed by this. The manual hint button reaches every rung, and
  // the offer bar proposes the same ones a few seconds later; the difference is
  // that the player now accepts them. A game master who wants the old pacing
  // turns `autoEnabled` back on at /admin/game-settings.
  DEFAULT_AUTO_HINT_ENABLED: false,
  // Seconds of thinking time before the next hint level is offered. Short
  // values hand the answer over before a player has engaged with the word;
  // there is always a manual hint button for anyone who wants one sooner.
  DEFAULT_AUTO_HINT_DURATION: 20,
  // "STEP"  - climb the ladder one level at a time: first letter, then
  //           scramble, then the AI clue. Cost rises with each step.
  // "ALL"   - skip the ladder and go straight to the AI clue.
  // Only "ALL" is special-cased; any other value behaves as "STEP".
  DEFAULT_AUTO_HINT_REVEAL_TYPE: "STEP",
};

/**
 * Rules constants shared by both game modes.
 *
 * These live here rather than beside the code that uses them so there is a
 * single place to read the game's balance from — they were previously split
 * between `gameLogic.ts` and `daily/dailyScoring.ts`, which each defined their
 * own `MAX_STRIKES`. Both files re-export from here, so every existing import
 * site is unchanged.
 */

/**
 * Fraction of a word's value forfeited at each hint tier, cumulatively.
 *
 * **All zero since 2026-09-13: hints in the daily game are free.**
 *
 * Every offer used to be a request to spend points, which is why accepting one
 * felt like an admission rather than like help — the game said "the player never
 * asks" while pricing every rung as though they had. The daily is one puzzle
 * everyone plays once; what a hint costs is not the score, it is the mark on the
 * grid at the end. `dailyShare` carries that now, and carries it for every rung
 * rather than only the clue.
 *
 * The constants survive at zero rather than being deleted because the classic
 * game reads the same table (`classicRules`), and because a game master turning
 * pricing back on should not need a deploy to do it.
 */
export const HINT_COSTS = {
  TIER_1: 0,
  TIER_2: 0,
  TIER_3: 0,
};

/** Strikes before a word is retired unsolved. */
export const MAX_STRIKES = 3;

/**
 * Whether hint level 2 shuffles what it reveals, or reveals it in place.
 *
 * **Off since 2026-09-13.** It was the one rung of the ladder that made a word
 * *harder* to hold in your head: level 1 hands you the first letter in its
 * place, and level 2 then took every position away again and handed back an
 * anagram. More information, less picture — which is exactly the moment players
 * described the word as getting away from them.
 *
 * The settle drip existed to sell those positions back one at a time, so an
 * entire second mechanic was there to undo this one. With the scramble off, the
 * ladder only ever adds to what the player can see, and the pool goes back to
 * meaning what it says: letters your own wrong guesses proved are in the word,
 * with no place yet.
 *
 * Read through `maskIsScrambled` rather than directly, so the question has one
 * answer everywhere — the mask generator, the two views that draw it, the pool,
 * and the legend that explains it all used to ask it separately.
 */
export const SCRAMBLE_MASK = false;

/** Whether a mask at this hint level is an anagram rather than positional. */
export function maskIsScrambled(hintLevel: number): boolean {
    return SCRAMBLE_MASK && hintLevel >= 2;
}

/** Highest hint level; level 3 is the AI clue. */
export const MAX_HINT_LEVEL = 3;

/** Guess similarity at or above this counts as correct. */
export const MATCH_THRESHOLD = 0.8;

/** Consecutive solves needed before the streak bonus applies. */
export const STREAK_BONUS_AT = 3;

export const STREAK_MULTIPLIER = 1.5;

/**
 * The letter pool: where found-but-unplaced letters live, and how they are placed.
 *
 * These are the compiled floor beneath `game_settings.letter_pool`, in the same
 * shape as every other game-master control — an unreachable settings table
 * degrades to exactly this rather than breaking the composer.
 */
export const LETTER_POOL = {
    /** Off returns the board to drawing found letters inside the word line. */
    ENABLED: true,
    /**
     * The caret jumps over confirmed letters, so the player types only the gaps
     * and never retypes a letter they earned. Turning this off gives the
     * familiar word-game shape: type the whole answer, greens acting as
     * checkpoints that mark a disagreement rather than blocking the keystroke.
     */
    CARET_SKIPS_GREENS: true,
} as const;

/**
 * The settle drip: found letters walking into place when a player is stuck.
 *
 * The rung between "take a hint" and "show me the word". The hint ladder ends
 * at the AI clue, and a player who has the anagram and the clue and still
 * cannot see it has exactly one button left, which scores zero. This sells
 * position back one letter at a time instead, so a word that was heading for a
 * reveal can still be solved by the player.
 *
 * It is deliberately the inverse of hint level 2: that level *destroys*
 * positional information by turning the mask into an anagram, and this gives it
 * back. Which is why it sits after the ladder rather than inside it -- it is a
 * different kind of information, not a cheaper grade of the same one.
 *
 * Compiled floor beneath `game_settings.settle`, in the same shape as every
 * other game-master control: an unreachable settings table plays exactly this.
 */
export const SETTLE = {
    /**
     * `offered` speaks first and waits to be accepted, which is the rule the
     * rest of the stuck machinery already follows -- a hint you request is an
     * admission, the same hint arriving as an offer is the game being generous.
     * `auto` lands letters unasked once the dwell clock runs out. `off` removes
     * the rung entirely and the ladder falls through to the reveal as before.
     */
    MODE: 'offered',
    /**
     * Earliest hint level the drip exists on.
     *
     * Two reasons it is 2 rather than 0. Below level 2 the pool is usually
     * empty -- nothing has been found, so there is nothing to place -- and the
     * rung is meant to be the last one before the reveal, not a shortcut past
     * the ladder.
     */
    ARM_FROM_HINT_LEVEL: 2,
    /** Dwell on the word before the first letter lands. `auto` mode only. */
    FIRST_DELAY_MS: 20_000,
    /** Gap between letters. This is the "slowly" in the whole idea. */
    INTERVAL_MS: 15_000,
    /** A wrong guess is worth this much dwell, as it is to the stuck offer. */
    STRIKE_CREDIT_MS: 12_000,
    /** Ceiling on the share of a word the drip may place. */
    MAX_FRACTION: 0.5,
    /**
     * Letters that must be left for the player, whatever the fraction says.
     *
     * Both floors are needed and neither subsumes the other: half of an
     * eleven-letter word leaves five, half of a four-letter word leaves two.
     * This is the one that stops the game solving the puzzle on short words.
     */
    MIN_UNSETTLED: 2,
    /**
     * Hint level from which the drip may place a letter the player has *not*
     * been shown, rather than only one already hanging around the word.
     *
     * The drip's founding rule was that it gives away positions and never new
     * letters, which was exactly right while hint 2 was an anagram: the pool
     * was full, and what the player lacked was where those letters went. With
     * `SCRAMBLE_MASK` off the pool is usually empty, so that rule quietly
     * became "the drip never fires": a player at the clue with no wrong guesses
     * behind them had no pool, therefore no candidates, therefore no offer and
     * no button — the ladder fell straight through to the Reveal, which is the
     * one move that ends in no solve at all.
     *
     * So from this level the drip may open a letter as well as place one. It is
     * the clue level rather than lower because the rung must stay the *last*
     * one before giving up: below it the player still has ladder left, and a
     * drip that hands out unseen letters earlier is a shortcut past the hints.
     *
     * `null` restores the pool-only rule.
     *
     * The two floors below still bind, so this can never solve the word — at
     * most half of it, and never the last two letters.
     */
    REVEAL_FROM_HINT_LEVEL: MAX_HINT_LEVEL as number | null,
    /** Which letter goes next. See `orderCandidates`. */
    ORDER: 'seeded',
    /** Fraction of the word's base value forfeited per settled letter. */
    COST_PER_LETTER: 0.05,
    /**
     * Floor on what a solve can be worth, as a fraction of base.
     *
     * A settled solve must stay strictly better than a reveal, which scores
     * nothing -- otherwise the rung argues for the very move it exists to
     * prevent. The floor is what guarantees that however the costs are tuned.
     */
    MIN_SCORE_FRACTION: 0.1,
} as const;

export const CIPHER_SIGNS = [...'⊗⊕⊖⊙⊚⊛⊠⌖⌂⌁⌇⌖⌂⌁🜁🜂🜄🜃🜁🜄🜂◆◇▲▼○●⬡⬢⬟░▲●★☆☉✵✶∝∞∧∨∩∪∴∵∶∷✷✸✹✺✱✲✢✣✤✥✦❈❉❊❋❀❁❂❃❖❘❙❚✦✧✩✪✫✬✭✮✯♃♄♅♆♇☉☾☽☿🜚🜛🜜🜝🜞🜟🜓🜔🜕🜖🜗🜘🜌🜅🜆🜇🜈🜉🜊🜋🜍🜎🜏🜐🜑'];

export const GAME_MODES = [
  { id: 'short', name: 'Short', limit: 25 },
  { id: 'medium', name: 'Medium', limit: 50 },
  { id: 'long', name: 'Long', limit: 100 },
  { id: 'very_long', name: 'Marathon', limit: 200 },
];


/* supabase query 
   to view corn jobs:
   select * from cron.job;

   to view executions:
   select * from cron.job_run_details order by start_time desc;
*/

/**
 * Compiled floor for the reward-feedback policy (sound, flourish, haptics).
 *
 * Same contract as the hint policy: these are what the game plays by when the
 * `daily_feedback` row in `game_settings` is absent, unreadable, or malformed,
 * so reward feedback never depends on a table being present. Overrides are
 * edited at /admin/game-settings and parsed by `src/lib/daily/feedbackPolicy.ts`.
 */
export const REWARD_FEEDBACK = {
  /** Master switch for the solve chime. A player's own mute still wins. */
  SOUND_ENABLED: true,
  /** Ceiling on how loud reward audio may play, 0–1. */
  VOLUME: 0.7,
  /** Whether a running streak transposes the chime up the pentatonic ladder. */
  STREAK_PITCH: true,
  /** A short, quiet descending tone on a wrong guess. */
  MISS_SOUND: true,
  /** Lowest solve tier that earns a particle burst; 'off' disables bursts. */
  BURST_FROM: 'solid',
  /** Scales the size and travel of every solve flourish, 0–1. */
  FLOURISH: 1,
  /** Short vibration on devices that support it. */
  HAPTICS: true,
};
