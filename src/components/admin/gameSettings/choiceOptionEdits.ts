import { CHOICE_OPTIONS, type ChoiceOption } from '@/lib/daily/stuckSignals';

/**
 * Editing the row of buttons the stuck offer forks into.
 *
 * Pure, and apart from the component, because the row is an ordered list rather
 * than a set of checkboxes: the order is what the player reads left to right,
 * so "in" and "where" are two different edits and both have to be reversible
 * without the panel guessing. Kept here so the rules can be tested without
 * rendering a select.
 */

/**
 * Every option, chosen ones first in the game master's order, then the rest in
 * the canonical one — so a row of switches never reshuffles under the cursor
 * when an option is switched off.
 */
export function orderedOptions(chosen: readonly ChoiceOption[]): ChoiceOption[] {
    return [...chosen, ...CHOICE_OPTIONS.filter((option) => !chosen.includes(option))];
}

/**
 * Adds an option to the end of the row, or takes it out.
 *
 * Added at the end rather than in canonical position: an option switched on is
 * the one the game master is thinking about, and dropping it into the middle of
 * the row moves buttons they did not touch.
 */
export function toggleOption(
    chosen: readonly ChoiceOption[],
    option: ChoiceOption,
): ChoiceOption[] {
    return chosen.includes(option)
        ? chosen.filter((entry) => entry !== option)
        : [...chosen, option];
}

/**
 * Moves a chosen option one place along the row. A move off either end, or of
 * an option that is not in the row at all, changes nothing.
 */
export function moveOption(
    chosen: readonly ChoiceOption[],
    option: ChoiceOption,
    delta: -1 | 1,
): ChoiceOption[] {
    const from = chosen.indexOf(option);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= chosen.length) return [...chosen];

    const next = [...chosen];
    next[from] = next[to];
    next[to] = option;
    return next;
}
