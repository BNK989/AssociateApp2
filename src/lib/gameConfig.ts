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
