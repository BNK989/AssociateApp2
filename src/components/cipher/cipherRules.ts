/** Filler alphabet for the locally generated fallback mask. */
const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

/** Symbols the server uses as masking filler. Must match gameLogic.ts. */
export const SPECIAL_CHARS = new Set(['~', '•', '$', '^', '+', '*', '=', '?', '#', '@', '&', '%']);

const SPECIAL_CHARS_ARRAY = Array.from(SPECIAL_CHARS);

export interface ScrambleItem {
    char: string;
    /** Stable across shuffles so layout animation can track the move. */
    id: string;
    isSpace: boolean;
    /** A real letter of the answer, styled and floated differently to filler. */
    isReal: boolean;
    /** Pinned in place — a green letter must not move. */
    locked?: boolean;
}

/** A mask the same length as `text`, never repeating a character in place. */
export function buildRandomCipher(text: string): string {
    return [...text].map((originalChar) => {
        if (originalChar === ' ') return ' ';
        let randomChar;
        do {
            randomChar = CHARS[Math.floor(Math.random() * CHARS.length)];
        } while (randomChar === originalChar);
        return randomChar;
    }).join('');
}

export type GuessState = {
    /** Positions where a guess had the right letter in the right place. */
    greenIndices: Set<number>;
    /** Letters known to be somewhere in the answer. */
    revealedChars: Set<string>;
};

/**
 * What the player has earned the right to see, from their wrong guesses.
 *
 * Green is a letter guessed in its correct position. Orange is a letter known
 * to be in the answer but not placed. Both are compared case-insensitively,
 * and only up to the shorter of guess and answer.
 */
export function computeGuessState(text: string, guesses: string[]): GuessState {
    const greenIndices = new Set<number>();
    const revealedChars = new Set<string>();
    const answer = [...text].map((c) => c.toLowerCase());

    for (const guess of guesses) {
        const guessChars = [...guess.toLowerCase()];
        const len = Math.min(guessChars.length, answer.length);

        for (let i = 0; i < len; i++) {
            if (guessChars[i] === answer[i]) {
                greenIndices.add(i);
            }
            if (answer[i] && answer.includes(guessChars[i])) {
                revealedChars.add(guessChars[i]);
            }
        }
    }

    return { greenIndices, revealedChars };
}

type BuildScrambleArgs = {
    textChars: string[];
    cipherChars: string[];
    guessState: GuessState;
    hintLevel: number;
    /** Injectable for tests; defaults to a random symbol. */
    pickFiller?: () => string;
};

/**
 * Turns the answer and its mask into the tiles the scramble view animates.
 *
 * The load-bearing rule is the letter budget. A tile may only show a real
 * letter if the player has earned it — as a green, as an orange, or because
 * the server's mask legitimately contains it and the answer still has an
 * unclaimed occurrence of that letter. Without the budget check a mask
 * containing an incidental 'e' would render a second visible 'e' in a word
 * that only has one, handing the player information they never earned.
 *
 * Any letter over budget is replaced with a filler symbol.
 */
export function buildScrambleItems({
    textChars,
    cipherChars,
    guessState,
    hintLevel,
    pickFiller = () => SPECIAL_CHARS_ARRAY[Math.floor(Math.random() * SPECIAL_CHARS_ARRAY.length)],
}: BuildScrambleArgs): ScrambleItem[] {
    const { greenIndices, revealedChars } = guessState;

    // Letters already accounted for by a green or orange tile.
    const claimed: Record<string, number> = {};
    textChars.forEach((char, i) => {
        const lower = char.toLowerCase();
        const isGreen = greenIndices.has(i);
        const isOrange = !isGreen && revealedChars.has(lower);
        if (isGreen || isOrange) {
            claimed[lower] = (claimed[lower] || 0) + 1;
        }
    });

    // How many of each letter the mask may still legitimately show.
    const budget: Record<string, number> = {};
    for (const char of textChars) {
        const lower = char.toLowerCase();
        budget[lower] = (budget[lower] || 0) + 1;
    }
    for (const key of Object.keys(budget)) {
        budget[key] = Math.max(0, budget[key] - (claimed[key] || 0));
    }

    const items = textChars.map((realChar, i) => {
        const isGreen = greenIndices.has(i);
        const isOrange = !isGreen && revealedChars.has(realChar.toLowerCase());
        const cipherChar = cipherChars[i];

        let charToShow = cipherChar;
        let isReal = false;
        let locked = false;

        if (isGreen) {
            charToShow = realChar;
            isReal = true;
            locked = true;
        } else if (isOrange) {
            charToShow = realChar;
            isReal = true;
        } else {
            const lower = (cipherChar ?? '').toLowerCase();
            const isFiller = SPECIAL_CHARS.has(cipherChar);
            const isAnswerLetter = !isFiller && lower.length > 0
                && [...textChars].some((c) => c.toLowerCase() === lower);

            if (isAnswerLetter && (budget[lower] || 0) > 0) {
                budget[lower]--;
                charToShow = cipherChar;
                isReal = true;
            } else if (isAnswerLetter) {
                // Over budget: showing this would leak a letter the player has not earned.
                charToShow = pickFiller();
                isReal = false;
            } else {
                charToShow = cipherChar;
                isReal = false;
            }
        }

        return {
            char: charToShow,
            id: `${i}-${charToShow}`,
            isSpace: realChar === ' ',
            isReal,
            // Spaces never move, so treat them as pinned.
            locked: locked || realChar === ' ',
        };
    });

    // Hint level 1 guarantees the first letter, so pin it regardless of the mask.
    if (hintLevel >= 1 && items.length > 0) {
        items[0] = {
            ...items[0],
            char: textChars[0],
            isReal: true,
            locked: true,
        };
    }

    return items;
}

/**
 * Reorders the tiles that are free to move, leaving pinned ones in place.
 *
 * Only positions change — the multiset of characters is preserved, so a shuffle
 * can never add or remove information.
 */
export function generateShuffledView(baseItems: ScrambleItem[]): ScrambleItem[] {
    const result = new Array<ScrambleItem>(baseItems.length);
    const movers: ScrambleItem[] = [];

    baseItems.forEach((item, idx) => {
        if (item.locked || item.isSpace) {
            result[idx] = item;
        } else {
            movers.push(item);
        }
    });

    for (let i = movers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [movers[i], movers[j]] = [movers[j], movers[i]];
    }

    let moverIndex = 0;
    for (let i = 0; i < result.length; i++) {
        if (!result[i]) result[i] = movers[moverIndex++];
    }

    return result;
}

/**
 * Positions where a new mask has revealed a real letter that the previous one
 * hid — used to flash the newly bought letters.
 */
export function findNewlyRevealedIndices(
    previousCipher: string,
    nextCipher: string,
    text: string,
): Set<number> {
    const prev = [...previousCipher];
    const next = [...nextCipher];
    const answer = [...text];
    const changed = new Set<number>();

    for (let i = 0; i < Math.max(prev.length, next.length); i++) {
        const now = next[i] || '';
        const before = prev[i] || '';
        if (now !== before && now === answer[i]) {
            changed.add(i);
        }
    }

    return changed;
}
