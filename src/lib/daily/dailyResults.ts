/**
 * The shape of a daily result and the rules for building and trusting one.
 *
 * Shared by both sides of the wire on purpose: the client builds a payload with
 * `buildResultPayload`, and the API route runs the same bytes back through
 * `parseResultPayload` before writing. The daily game is scored entirely in the
 * browser, so the server cannot verify that a score is *earned* -- what it can
 * and does verify is that every field is the right type and inside a possible
 * range, so one bad client cannot poison the measurements we are collecting
 * this for.
 */

/** How a word left the board. A word always ends in exactly one of these. */
export type WordOutcome = 'solved' | 'gave_up' | 'struck_out';

export const WORD_OUTCOMES: readonly WordOutcome[] = ['solved', 'gave_up', 'struck_out'];

/** Highest hint level a word can carry; mirrors MAX_HINT_LEVEL in dailyScoring. */
const MAX_HINT_LEVEL = 3;

/** Strikes allowed per word; mirrors MAX_STRIKES in dailyScoring. */
const MAX_STRIKES = 3;

/**
 * Ceiling on the active time credited to a single word.
 *
 * The timer already stops while the tab is hidden, but that misses the player
 * who leaves the tab focused and walks away. Ten minutes on one word is beyond
 * any real attention span for a five-word chain, so anything above it is a
 * walked-away session rather than a slow solve, and counting it would drag
 * every median we compute.
 */
export const MAX_WORD_MS = 10 * 60 * 1000;

/** An upper bound on chain length, used to reject absurd payloads. */
export const MAX_CHAIN_WORDS = 30;

export type WordResult = {
    /** Position in the chain, in play order. */
    index: number;
    outcome: WordOutcome;
    hint_level: number;
    strikes: number;
    points: number;
    /** Active time spent on this word, already capped. */
    ms: number;
};

export type DailyResultPayload = {
    client_id: string;
    play_date: string;
    words_total: number;
    words_solved: number;
    score: number;
    hints_used: number;
    strikes: number;
    duration_ms: number;
    completed: boolean;
    per_word: WordResult[];
};

function previousDay(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * Consecutive days finished, counting back from `playDate`.
 *
 * The walk stops at the first gap rather than counting completions, so a player
 * who finished Monday and Wednesday has a streak of one on Wednesday, not two.
 * A day the player did not finish breaks it, which is the whole point of the
 * number.
 */
export function countStreak(completedDates: Iterable<string>, playDate: string): number {
    const finished = new Set(completedDates);

    let streak = 0;
    let cursor = playDate;

    while (finished.has(cursor)) {
        streak++;
        cursor = previousDay(cursor);
    }

    return streak;
}

/** Clamps a raw elapsed time into the range we are willing to believe. */
export function clampWordMs(ms: number): number {
    if (!Number.isFinite(ms) || ms < 0) return 0;
    return Math.min(Math.round(ms), MAX_WORD_MS);
}

type BuildArgs = {
    clientId: string;
    playDate: string;
    wordsTotal: number;
    score: number;
    perWord: WordResult[];
    completed: boolean;
};

/**
 * Rolls the per-word log up into the row we store.
 *
 * Every summary column is derived here rather than tracked alongside, so the
 * totals cannot drift from the detail they claim to summarise.
 */
export function buildResultPayload({
    clientId,
    playDate,
    wordsTotal,
    score,
    perWord,
    completed,
}: BuildArgs): DailyResultPayload {
    return {
        client_id: clientId,
        play_date: playDate,
        words_total: wordsTotal,
        words_solved: perWord.filter((w) => w.outcome === 'solved').length,
        score,
        hints_used: perWord.reduce((sum, w) => sum + w.hint_level, 0),
        strikes: perWord.reduce((sum, w) => sum + w.strikes, 0),
        duration_ms: perWord.reduce((sum, w) => sum + clampWordMs(w.ms), 0),
        completed,
        per_word: perWord.map((w) => ({ ...w, ms: clampWordMs(w.ms) })),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedInt(value: unknown, min: number, max: number): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const rounded = Math.round(value);
    if (rounded < min || rounded > max) return null;
    return rounded;
}

function parseWordResult(raw: unknown, wordsTotal: number): WordResult | null {
    if (!isRecord(raw)) return null;

    const index = boundedInt(raw.index, 0, wordsTotal - 1);
    const hint_level = boundedInt(raw.hint_level, 0, MAX_HINT_LEVEL);
    const strikes = boundedInt(raw.strikes, 0, MAX_STRIKES);
    const points = boundedInt(raw.points, 0, Number.MAX_SAFE_INTEGER);
    const ms = boundedInt(raw.ms, 0, MAX_WORD_MS);
    const outcome = raw.outcome;

    if (index === null || hint_level === null || strikes === null) return null;
    if (points === null || ms === null) return null;
    if (typeof outcome !== 'string' || !WORD_OUTCOMES.includes(outcome as WordOutcome)) return null;

    return { index, outcome: outcome as WordOutcome, hint_level, strikes, points, ms };
}

export type ParseFailure = { ok: false; reason: string };
export type ParseSuccess = { ok: true; payload: DailyResultPayload };

/**
 * Validates an untrusted request body into a payload safe to write.
 *
 * `wordsTotal` comes from the stored chain for that date, not from the request,
 * so a client cannot claim a longer game than the one that was actually served
 * and cannot smuggle a per-word index past the end of it.
 */
export function parseResultPayload(body: unknown, wordsTotal: number): ParseSuccess | ParseFailure {
    if (!isRecord(body)) return { ok: false, reason: 'body is not an object' };

    const { client_id, play_date, score, completed, per_word } = body;

    // Charset is restricted, not merely length-checked: the streak query builds
    // a PostgREST `or` filter from this value, and that filter is a string
    // grammar rather than a parameterised query.
    if (typeof client_id !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(client_id)) {
        return { ok: false, reason: 'client_id missing or malformed' };
    }
    if (typeof play_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(play_date)) {
        return { ok: false, reason: 'play_date is not an ISO date' };
    }
    if (typeof completed !== 'boolean') {
        return { ok: false, reason: 'completed is not a boolean' };
    }
    if (!Array.isArray(per_word)) {
        return { ok: false, reason: 'per_word is not an array' };
    }
    if (per_word.length > wordsTotal) {
        return { ok: false, reason: 'per_word is longer than the chain' };
    }

    const parsedScore = boundedInt(score, 0, 10_000_000);
    if (parsedScore === null) return { ok: false, reason: 'score out of range' };

    const parsedWords: WordResult[] = [];
    for (const entry of per_word) {
        const parsed = parseWordResult(entry, wordsTotal);
        if (!parsed) return { ok: false, reason: 'per_word contains a malformed entry' };
        parsedWords.push(parsed);
    }

    return {
        ok: true,
        payload: buildResultPayload({
            clientId: client_id,
            playDate: play_date,
            wordsTotal,
            score: parsedScore,
            perWord: parsedWords,
            completed,
        }),
    };
}
