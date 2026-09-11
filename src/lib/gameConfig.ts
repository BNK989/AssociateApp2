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
  DEFAULT_AUTO_HINT_ENABLED: true,
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

/** Fraction of a word's value forfeited at each hint tier, cumulatively. */
export const HINT_COSTS = {
  TIER_1: 0.10, // 10%
  TIER_2: 0.10, // Another 10%
  TIER_3: 0.40, // 40%
};

/** Strikes before a word is retired unsolved. */
export const MAX_STRIKES = 3;

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
