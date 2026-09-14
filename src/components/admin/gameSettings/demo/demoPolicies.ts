import type { DailyHintPolicy } from '@/lib/daily/hintPolicy';
import type { DailyFeedbackPolicy } from '@/lib/daily/feedbackPolicy';
import type { LetterPoolPolicy } from '@/lib/daily/letterPoolPolicy';
import type { SettlePolicy } from '@/lib/daily/settlePolicy';

/**
 * The four drafts the demo board plays by.
 *
 * The panel edits four independent policy rows, and the board a game master
 * tests with has to be driven by all four at once: the ladder decides what the
 * word shows, the settle policy decides when the game speaks and what the drip
 * costs, the letter pool decides how the composer behaves, and the feedback
 * policy decides what a solve looks like. Passing them as one object keeps the
 * demo from growing a fifth prop every time a policy gains a field.
 *
 * These are the *drafts*, not the saved rows. A demo running on what is already
 * in the table would show the game as it is rather than as it is about to be,
 * which is the opposite of what a test board is for.
 */
export type DemoPolicies = {
    hint: DailyHintPolicy;
    feedback: DailyFeedbackPolicy;
    letterPool: LetterPoolPolicy;
    settle: SettlePolicy;
};
