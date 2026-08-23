/**
 * The fixed chain the game-settings demo plays.
 *
 * A real day's chain is generated and translated at runtime, which is exactly
 * what a preview must not depend on: the game master needs the same board every
 * time so that what changes between two runs is their setting and nothing else.
 *
 * Presented newest-last, like the real one — the final word is the freebie the
 * player is handed, and they work backwards from it.
 */
export const DEMO_WORDS = ['Orchestra', 'Conductor', 'Baton', 'Relay'] as const;

/**
 * Stand-ins for the AI clues, indexed to match `DEMO_WORDS`.
 *
 * Written by hand rather than fetched: the clue endpoint is rate limited, and a
 * preview that spends the day's quota to show a game master what level 3 looks
 * like would be a poor trade.
 */
export const DEMO_CLUES = [
    'A large group of musicians playing together',
    'Stands at the front and keeps everyone in time',
    'The slim stick that sets the tempo',
    'A race run in legs, each runner handing on to the next',
] as const;

/** Clue for a word by its position, in the shape `applyArrivalHint` expects. */
export function demoClue(index: number): string {
    return DEMO_CLUES[index] ?? DEMO_CLUES[0];
}
