import type { ChainHistory } from './chainValidation';
import type { DayPlan } from './themeWheel';

/**
 * Builds the instruction handed to the model for one day's chain.
 *
 * Two things here are deliberate and easy to undo by accident.
 *
 * There is **no worked example**. The old prompt showed
 * `["Sun", "Morning", "Coffee", "Bean", "Stalk"]`, and the model kept handing
 * back that chain's neighbourhood -- morning routines, coffee, light. An
 * example of the format is useful; an example made of real words is a
 * suggestion, and the model takes it. The shape is described with placeholders
 * instead.
 *
 * And the subject is **assigned, not requested**. Asked to choose a theme, the
 * model returns its favourites, which is how the same theme landed two days
 * running. The day's domain and angle come from the wheel before we get here.
 */

/** Recent vocabulary is truncated so the exclusion list cannot crowd out the task. */
const MAX_EXCLUDED_WORDS = 150;

const MAX_EXCLUDED_THEMES = 40;

function formatList(items: string[], limit: number): string {
    return items.slice(0, limit).join(', ');
}

/**
 * The rules of the chain itself, phrased for someone who has never seen the game.
 *
 * The reversal matters: players are shown the LAST word and work backwards, so
 * each hint has to describe its word in terms of the one that follows it, and
 * the final word is the only one that gets a plain definition.
 */
function chainRules(plan: DayPlan): string {
    return [
        `Write a chain of exactly ${plan.words} words where each word associates naturally with the one after it.`,
        'Players are shown the final word first and guess backwards along the chain, so every link must read in both directions.',
        `Aim for a mean connection strength around ${((plan.minConnection + plan.maxConnection) / 2).toFixed(2)} on a 0-1 scale, where 1 is an obvious pairing and 0.6 is an oblique one.`,
        `Today should feel ${plan.mood}.`,
        '',
        vocabularyRule(),
    ].join('\n');
}

/**
 * Keeps the difficulty in the puzzle rather than in the dictionary.
 *
 * Without this the model reaches for specialist registers as soon as it is
 * asked for a harder day -- an early run produced a mining chain opening on
 * "Headframe" and closing on "Slag". Those are not hard associations, they are
 * unfamiliar words, and a player who has never met the word cannot reason
 * their way to it however cleverly it is linked. The connection band already
 * carries difficulty; vocabulary should not.
 */
function vocabularyRule(): string {
    return [
        'Use everyday words that an ordinary adult would use in conversation.',
        'No technical or trade jargon, no specialist terminology, nothing a non-specialist would have to look up.',
        'A harder day means a less obvious connection between familiar words -- never a rarer word.',
        'The player must be able to think their way to each answer from the words around it.',
    ].join('\n');
}

function hintRules(): string {
    return [
        'Write one hint per word, in the same order.',
        'For the final word, write a plain definition.',
        'For every other word, describe that word in a way that also gestures at the word which follows it.',
        'Never refer to the list itself: no "the next word", "the following word", "the one below".',
        'A hint must never contain the word it is a hint for.',
    ].join('\n');
}

function exclusions(history: ChainHistory): string {
    const parts: string[] = [];

    if (history.recentThemes.length > 0) {
        parts.push(
            'These themes have been used recently. Do not repeat them, and do not submit a reworded version of one:',
            formatList(history.recentThemes, MAX_EXCLUDED_THEMES),
        );
    }

    if (history.recentWords.length > 0) {
        parts.push(
            'These words have appeared in recent puzzles and must not appear in yours:',
            formatList(history.recentWords, MAX_EXCLUDED_WORDS),
        );
    }

    return parts.join('\n');
}

/**
 * Format described with placeholders rather than real words, so nothing in the
 * shape of the answer leaks vocabulary into it.
 */
function outputFormat(plan: DayPlan): string {
    return [
        'Return ONLY a JSON object, with no prose and no code fence, in exactly this shape:',
        '{',
        '  "theme": "<a short evocative title, 2-4 words>",',
        `  "words": [<${plan.words} strings, each one or two words, capitalised>],`,
        `  "hints": [<${plan.words} strings, one per word, same order>],`,
        `  "connection_scores": [<${plan.words} numbers between 0.5 and 1.0, one per word>]`,
        '}',
    ].join('\n');
}

export type PromptArgs = {
    plan: DayPlan;
    history: ChainHistory;
    /** Why the previous attempt was rejected, fed back so the retry can correct. */
    rejectionReasons?: string[];
};

export function buildChainPrompt({ plan, history, rejectionReasons }: PromptArgs): string {
    const sections = [
        'You are composing the daily word-association puzzle for a game called Associ8.',
        '',
        `Subject for today: ${plan.domain}.`,
        `Approach it through: ${plan.angle}.`,
        'Invent a specific, fresh theme inside that subject. Do not write about the subject in general terms.',
        '',
        chainRules(plan),
        '',
        hintRules(),
    ];

    const excluded = exclusions(history);
    if (excluded) {
        sections.push('', excluded);
    }

    if (rejectionReasons && rejectionReasons.length > 0) {
        sections.push(
            '',
            'Your previous attempt was rejected for these reasons. Fix all of them:',
            ...rejectionReasons.map((reason) => `- ${reason}`),
        );
    }

    sections.push('', outputFormat(plan));

    return sections.join('\n');
}
