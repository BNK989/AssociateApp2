/**
 * Picks the subject and shape of a given day's chain.
 *
 * The generator used to be handed nothing but the date, and language models
 * have strong attractors for "word association chain" -- left to itself it
 * returned orchestras and morning coffee over and over. On 2026-08-20 and
 * 2026-08-21 it produced the same theme two days running, sharing three words.
 *
 * So the subject is decided here, before the model is asked anything, and the
 * model is told what to write about rather than left to choose. Everything in
 * this module is deterministic on the date: the same day always yields the same
 * plan, which makes a puzzle reproducible and this file testable.
 */

/** Reference day for the cycle arithmetic. Any fixed date works. */
const EPOCH = Date.UTC(2026, 0, 1);

const MS_PER_DAY = 86_400_000;

/**
 * Subject domains, drawn one per day.
 *
 * Deliberately broad and concrete -- these are areas a five-word chain can live
 * inside, not themes in themselves. The model still invents the theme; this
 * only decides which part of the world it comes from.
 */
export const DOMAINS = [
    'Nature and weather',
    'Food and cooking',
    'Music and sound',
    'Sport and movement',
    'Cinema and television',
    'Technology and machines',
    'History and the past',
    'Myth, legend and folklore',
    'Travel and places',
    'The body and health',
    'The home and everyday objects',
    'Animals',
    'Art and craft',
    'Language and words',
    'Games and play',
    'Transport and journeys',
    'Clothing and style',
    'Space and science',
    'Trades and working life',
    'Money, trade and markets',
] as const;

/**
 * A second axis, so the same domain twice does not mean the same puzzle twice.
 * Seven of these against twenty domains means a given pairing recurs only
 * every 140 days.
 */
export const ANGLES = [
    'concrete physical objects',
    'actions and verbs',
    'sensory detail -- texture, sound, smell',
    'people and the roles they play',
    'places and spaces',
    'processes, and the steps within them',
    'materials and what things are made of',
] as const;

export type Domain = (typeof DOMAINS)[number];
export type Angle = (typeof ANGLES)[number];

export type WeekdayPlan = {
    /** Target chain length, including the freely revealed final word. */
    words: number;
    /** Acceptable band for the mean connection strength. */
    minConnection: number;
    maxConnection: number;
    /** Shorthand handed to the model to colour the day's difficulty. */
    mood: string;
};

/**
 * Difficulty and length across the week.
 *
 * Monday is a warm-up and Saturday is the wall, on the crossword convention
 * that a daily puzzle should have a shape across the week rather than one
 * constant setting. Sunday deliberately breaks the ramp so the week does not
 * simply end.
 *
 * Length varies alongside tightness because it is the other half of how long a
 * chain feels. `minConnection`/`maxConnection` bound the *mean* link strength:
 * a low band means more oblique associations, not merely more words.
 */
export const WEEKDAY_PLANS: Record<number, WeekdayPlan> = {
    0: { words: 8, minConnection: 0.78, maxConnection: 0.95, mood: 'playful and a little surprising' },
    1: { words: 6, minConnection: 0.82, maxConnection: 1.0, mood: 'gentle -- an easy way into the week' },
    2: { words: 7, minConnection: 0.80, maxConnection: 0.97, mood: 'straightforward' },
    3: { words: 8, minConnection: 0.76, maxConnection: 0.93, mood: 'moderate' },
    4: { words: 9, minConnection: 0.72, maxConnection: 0.90, mood: 'a real puzzle' },
    5: { words: 10, minConnection: 0.68, maxConnection: 0.86, mood: 'demanding' },
    6: { words: 12, minConnection: 0.60, maxConnection: 0.80, mood: 'the hardest of the week -- oblique links are welcome' },
};

export type DayPlan = {
    playDate: string;
    domain: Domain;
    angle: Angle;
    weekday: number;
} & WeekdayPlan;

/** Small deterministic PRNG (mulberry32), so a seed always shuffles the same way. */
function seededRandom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffled<T>(items: readonly T[], seed: number): T[] {
    const out = [...items];
    const rand = seededRandom(seed);

    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }

    return out;
}

export function daysSinceEpoch(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Math.floor((Date.UTC(y, m - 1, d) - EPOCH) / MS_PER_DAY);
}

/** Mixing constant for deriving a cycle's shuffle seed. */
const SEED_MULT = 2654435761;

/**
 * Days a subject must sit out before it can come round again.
 *
 * A plain shuffled cycle guarantees no repeat *within* a cycle, but says
 * nothing about the seam: the last draw of one cycle can be the first of the
 * next, putting the same subject on consecutive days -- exactly the failure
 * that prompted this module. Scaled to the list so a short list is not asked
 * for a gap it cannot give.
 */
function gapFor(size: number): number {
    return Math.max(1, Math.min(4, Math.floor(size / 4)));
}

/**
 * The order a cycle draws its items in: a shuffle, with the head cleared of
 * anything the previous cycle used in its tail.
 *
 * Computed for the whole cycle rather than per day. Doing it per day was a bug
 * -- the fix-up applied only on the day it was needed, so the other days of the
 * cycle read the unshuffled order and one subject came up twice while another
 * never appeared at all.
 *
 * Swaps only ever pull from the middle, never the last `gap` slots, so a
 * cycle's tail is always its raw shuffle. That keeps the lookback one level
 * deep instead of recursing back through every previous cycle.
 */
function cycleOrder<T>(items: readonly T[], cycle: number): T[] {
    const size = items.length;
    const order = shuffled(items, cycle * SEED_MULT);
    if (cycle <= 0) return order;

    const gap = gapFor(size);
    const previousTail = new Set(shuffled(items, (cycle - 1) * SEED_MULT).slice(size - gap));

    let mid = Math.max(gap, Math.floor(size / 2) - 1);

    for (let i = 0; i < gap; i++) {
        if (!previousTail.has(order[i])) continue;

        while (mid < size - gap && previousTail.has(order[mid])) mid++;
        if (mid >= size - gap) break;

        [order[i], order[mid]] = [order[mid], order[i]];
        mid++;
    }

    return order;
}

/**
 * Draws one item per day from a cycle that uses every item before repeating.
 *
 * Each cycle is shuffled from its own seed, so the order is not the same loop
 * forever, and the seam between cycles is cleared so a subject cannot return
 * for at least `gapFor(size)` days.
 */
function drawFromCycle<T>(items: readonly T[], day: number): T {
    const size = items.length;
    const cycle = Math.floor(day / size);
    const position = ((day % size) + size) % size;

    return cycleOrder(items, cycle)[position];
}

/** Everything the generator needs to know about a date before it asks the model. */
export function planForDate(dateStr: string): DayPlan {
    const day = daysSinceEpoch(dateStr);
    const [y, m, d] = dateStr.split('-').map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const plan = WEEKDAY_PLANS[weekday];

    return {
        playDate: dateStr,
        domain: drawFromCycle(DOMAINS, day),
        angle: drawFromCycle(ANGLES, day),
        weekday,
        ...plan,
    };
}
