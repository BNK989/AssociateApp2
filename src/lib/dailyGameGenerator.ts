import { createAdminClient } from './supabase-admin';
import { GAME_CONFIG } from './gameConfig';
import { createLogger } from '@/lib/logger';
import { planForDate, type DayPlan } from '@/lib/daily/themeWheel';
import { buildChainPrompt } from '@/lib/daily/generationPrompt';
import { validateChain, type ChainHistory, type GeneratedChain } from '@/lib/daily/chainValidation';
import { getFallbackChain } from '@/lib/daily/fallbackPool';

const log = createLogger('daily/generate');

/** Days of themes the generator is told to avoid echoing. */
const THEME_LOOKBACK_DAYS = 60;

/** Days of vocabulary the generator may not reuse. */
const WORD_LOOKBACK_DAYS = 30;

/** Attempts per model before moving to the next one. */
const ATTEMPTS_PER_MODEL = 2;

/** Used when the model returns no scores of its own. */
const DEFAULT_CONNECTION = 0.85;

export interface DailyGameData {
    id?: string;
    play_date: string;
    theme: string;
    words: string[];
    hints: string[];
    connection_scores: number[];
    created_at?: string;
}

const MODELS = [
    GAME_CONFIG.AI_HINT_MODEL,
    GAME_CONFIG.AI_HINT_BACKUP_MODEL,
    'gemma-4-26b-a4b-it',
    'gemini-2.5-flash-lite',
];

function shiftDate(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * What the last two months of puzzles already used.
 *
 * This is the single thing the old generator lacked. It was handed the date and
 * nothing else, so it had no way to know it had written the same theme
 * yesterday -- which, on 2026-08-20 and 2026-08-21, it did.
 */
export async function fetchChainHistory(dateStr: string): Promise<ChainHistory> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from('daily_games')
        .select('play_date, theme, words')
        .gte('play_date', shiftDate(dateStr, -THEME_LOOKBACK_DAYS))
        .lt('play_date', dateStr)
        .order('play_date', { ascending: false });

    if (error) {
        log.warn('history', 'Could not read recent puzzles; generating without an exclusion list', { play_date: dateStr }, error);
        return { recentThemes: [], recentWords: [] };
    }

    const wordCutoff = shiftDate(dateStr, -WORD_LOOKBACK_DAYS);
    const recentThemes: string[] = [];
    const recentWords: string[] = [];

    for (const row of data ?? []) {
        if (row.theme) recentThemes.push(row.theme);
        if (row.play_date >= wordCutoff && Array.isArray(row.words)) {
            recentWords.push(...row.words);
        }
    }

    return { recentThemes, recentWords };
}

/** Pulls a JSON object out of a model response that may be fenced or padded with prose. */
export function parseChainResponse(rawText: string): GeneratedChain | null {
    let text = rawText.trim();

    if (text.startsWith('```json')) {
        text = text.replace(/^```json/, '').replace(/```$/, '');
    } else if (text.startsWith('```')) {
        text = text.replace(/^```/, '').replace(/```$/, '');
    }

    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first === -1 || last === -1) return null;

    try {
        const parsed = JSON.parse(text.substring(first, last + 1));

        if (!parsed || typeof parsed.theme !== 'string' || !Array.isArray(parsed.words)) return null;

        return {
            theme: parsed.theme.trim(),
            words: parsed.words.map((w: unknown) => String(w).trim()),
            hints: Array.isArray(parsed.hints) ? parsed.hints.map((h: unknown) => String(h).trim()) : undefined,
            connection_scores: Array.isArray(parsed.connection_scores)
                ? parsed.connection_scores.map((s: unknown) => (typeof s === 'number' ? s : DEFAULT_CONNECTION))
                : undefined,
        };
    } catch {
        return null;
    }
}

async function callModel(model: string, prompt: string, apiKey: string): Promise<string | null> {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        },
    );

    if (!response.ok) {
        log.warn('generate', 'Model returned an HTTP error, moving on', { model, status: response.status });
        return null;
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

/**
 * Asks for a chain until one passes validation.
 *
 * Rejection reasons are fed back into the next prompt rather than discarded, so
 * a retry is a correction rather than another roll of the dice. Each model gets
 * a couple of attempts before we try the next; if none of them produces a
 * usable chain, the caller falls back to a hand-written one.
 */
export async function generateChain(plan: DayPlan, history: ChainHistory): Promise<GeneratedChain | null> {
    const apiKey = process.env.GEMINI_KEY;

    if (!apiKey) {
        log.warn('generate', 'GEMINI_KEY not set, using the curated fallback pool', { play_date: plan.playDate });
        return null;
    }

    let rejectionReasons: string[] | undefined;

    for (const model of MODELS) {
        for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
            try {
                const raw = await callModel(model, buildChainPrompt({ plan, history, rejectionReasons }), apiKey);
                if (!raw) continue;

                const chain = parseChainResponse(raw);
                if (!chain) {
                    rejectionReasons = ['the response was not valid JSON in the requested shape'];
                    log.warn('generate', 'Model response could not be parsed', { model, attempt, play_date: plan.playDate });
                    continue;
                }

                const verdict = validateChain(chain, plan, history);

                if (verdict.ok) {
                    log.debug('generate', 'Accepted a chain', {
                        play_date: plan.playDate,
                        model,
                        attempt,
                        theme: chain.theme,
                        domain: plan.domain,
                    });
                    return chain;
                }

                rejectionReasons = verdict.reasons;
                log.warn('generate', 'Rejected a generated chain, retrying with feedback', {
                    play_date: plan.playDate,
                    model,
                    attempt,
                    theme: chain.theme,
                    reasons: verdict.reasons.join('; '),
                });
            } catch (err) {
                log.warn('generate', 'Model call failed, trying again', { model, attempt, play_date: plan.playDate }, err);
            }
        }
    }

    log.error('generate', 'No model produced a usable chain; falling back to a curated one', {
        play_date: plan.playDate,
        domain: plan.domain,
        last_rejection: rejectionReasons?.join('; '),
    });

    return null;
}

/** Fills in whatever the model left out, so the row is always well-formed. */
function toGameContent(chain: GeneratedChain): Omit<DailyGameData, 'id' | 'play_date' | 'created_at'> {
    return {
        theme: chain.theme,
        words: chain.words,
        hints: chain.hints ?? [],
        connection_scores: chain.connection_scores?.length === chain.words.length
            ? chain.connection_scores.map((s) => Math.max(0.1, Math.min(1, s)))
            : chain.words.map(() => DEFAULT_CONNECTION),
    };
}

/**
 * Generates (or reuses) the puzzle for a date and stores it.
 *
 * Safe to call concurrently: the first writer wins and everyone else re-reads
 * the row it inserted, so every player on a date gets the same chain.
 */
export async function generateAndStoreDailyGame(dateStr: string): Promise<DailyGameData> {
    const supabase = createAdminClient();

    const { data: existingGame } = await supabase
        .from('daily_games')
        .select('*')
        .eq('play_date', dateStr)
        .maybeSingle();

    if (existingGame) return existingGame as DailyGameData;

    const plan = planForDate(dateStr);
    const history = await fetchChainHistory(dateStr);
    const generated = await generateChain(plan, history);

    const gameContent = generated
        ? toGameContent(generated)
        : toGameContent(getFallbackChain(dateStr, plan.domain));

    const { data: insertedGame, error: insertError } = await supabase
        .from('daily_games')
        .insert({ play_date: dateStr, ...gameContent })
        .select('*')
        .single();

    if (insertError) {
        log.warn('persist', 'Insert conflict, checking whether the game was created concurrently', { play_date: dateStr }, insertError);

        const { data: reFetchedGame } = await supabase
            .from('daily_games')
            .select('*')
            .eq('play_date', dateStr)
            .maybeSingle();

        if (reFetchedGame) return reFetchedGame as DailyGameData;

        return { play_date: dateStr, ...gameContent };
    }

    return insertedGame as DailyGameData;
}
