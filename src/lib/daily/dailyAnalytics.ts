import type { GuessBand } from './guessFeedback';
import type { WordOutcome } from './dailyResults';
import { dailyPuzzleNumber } from './dailyShare';

/**
 * The daily game's PostHog contract.
 *
 * Every event the daily game emits is named and typed here, and every one of
 * them is built by `dailyEvent` so it carries the same context. That matters
 * more than it sounds: an event is only analysable if it can be *broken down*,
 * and a property that is present on `daily_word_solved` but missing on
 * `daily_word_revealed` cannot be compared across the two. Capturing inline at
 * each call site is how that divergence happens, so no call site captures
 * inline — `useDailyAnalytics` is the only door.
 *
 * Names already in the wild (`daily_game_entered`, `daily_word_solved`,
 * `daily_game_completed`) keep their spelling so historical data is not
 * orphaned. Properties are snake_case, matching PostHog convention and the
 * events documented in `knowledge base/events.md`.
 */

export type UserType = 'registered' | 'guest';

/** How a hint reached the player. */
export type HintSource = 'auto' | 'manual' | 'start_level';

/**
 * Context stamped onto every daily event.
 *
 * `puzzle_number` is derived rather than passed: it is the number players see
 * and share, and deriving it means an event can never disagree with the grid.
 * `settings_revision` is what makes a balance change measurable — outcomes
 * grouped by it are the before and after of a game-master edit.
 */
export type DailyContext = {
    play_date: string;
    user_type: UserType;
    settings_revision: number;
    words_total: number;
};

export type WordContext = {
    /** Position in the chain, in play order — the same index results use. */
    word_index: number;
    /** Hint level the word carried at the moment of the event. */
    hint_level: number;
    strikes: number;
    /** Times this word has been parked and come back. */
    park_count: number;
    /** Active milliseconds the player has spent on this word. */
    ms_on_word: number;
};

export type DailyEventProps = {
    daily_game_entered: Record<string, never>;

    /** A word left the board solved. */
    daily_word_solved: WordContext & {
        word: string;
        score_gained: number;
        total_score: number;
        consecutive: number;
        /** True when the word was solved after coming back from a park. */
        solved_after_park: boolean;
    };

    /**
     * The player asked to see a word rather than keep guessing.
     *
     * Called `revealed` and not `gave_up` on purpose: the product no longer
     * frames this as surrender, and an event name that still did would keep the
     * old framing alive in every dashboard built on it.
     */
    daily_word_revealed: WordContext & {
        /** Whether the ladder was exhausted before they reached for it. */
        hints_exhausted: boolean;
        total_score: number;
        consecutive: number;
    };

    /** A word ran out of strikes. */
    daily_word_struck_out: WordContext & { total_score: number };

    /** A word went to the back of the queue instead of off the board. */
    daily_word_parked: WordContext & { words_remaining: number };

    /** A parked word came back to the front. */
    daily_word_returned: WordContext & { words_remaining: number };

    /**
     * A wrong guess.
     *
     * `similarity` rides along with `band` so the band's thresholds can be
     * re-cut from real data rather than argued about — see NEAR_MISS_THRESHOLD.
     */
    daily_guess_missed: WordContext & {
        band: Exclude<GuessBand, 'match'>;
        similarity: number;
        /** Whether the near-miss rule spared the player a strike. */
        strike_forgiven: boolean;
    };

    /** A hint landed, whether the player asked for it or the clock gave it. */
    daily_hint_revealed: WordContext & {
        source: HintSource;
        /** Level the word moved to; may skip a rung the ladder judged useless. */
        to_level: number;
    };

    /** The last word left the board. */
    daily_game_completed: {
        final_score: number;
        ended_on: WordOutcome;
        words_solved: number;
        /** Grid tier: perfect | strong | partial | blank. */
        outcome_tier: string;
        hints_taken: number;
        words_revealed: number;
        parks_used: number;
    };

    /**
     * The end screen showed the chain and the day's theme.
     *
     * Separate from completion because the point of the reveal is that *every*
     * tier gets it, including a blank board — this event is how we check that a
     * player who solved nothing still saw the payoff.
     */
    daily_chain_revealed: {
        outcome_tier: string;
        words_solved: number;
    };
};

export type DailyEventName = keyof DailyEventProps;

export type DailyEvent = {
    name: DailyEventName;
    properties: Record<string, unknown>;
};

/**
 * An event with its context merged in, ready to hand to PostHog.
 *
 * Pure and exported so the property shape can be asserted in a test rather than
 * discovered in production three weeks after a dashboard was built on it.
 */
export function dailyEvent<N extends DailyEventName>(
    context: DailyContext,
    name: N,
    props: DailyEventProps[N],
): DailyEvent {
    return {
        name,
        properties: {
            ...context,
            puzzle_number: dailyPuzzleNumber(context.play_date),
            // Kept for continuity: the original events shipped the play date as
            // `date`, and existing insights filter on it.
            date: context.play_date,
            ...props,
        },
    };
}

/** The parts of a board word `wordContext` needs; deliberately not a Message. */
export type WordSnapshot = {
    hint_level?: number | null;
    strikes?: number | null;
    park_count?: number | null;
};

/**
 * The per-word half of an event's properties, built in one place.
 *
 * Every word-level event goes through here so `daily_guess_missed` and
 * `daily_word_solved` describe a word the same way and can be joined on it —
 * the whole point of the contract. Defaults are applied here too, so a board
 * word that predates a field reports `0` rather than `undefined`, which PostHog
 * would otherwise drop from the property set entirely.
 */
export function wordContext(
    word: WordSnapshot,
    index: number,
    msOnWord: number,
): WordContext {
    return {
        word_index: index,
        hint_level: word.hint_level ?? 0,
        strikes: word.strikes ?? 0,
        park_count: word.park_count ?? 0,
        ms_on_word: Math.round(msOnWord),
    };
}
