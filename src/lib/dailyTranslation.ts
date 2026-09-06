import { unstable_cache } from 'next/cache';
import { AsyncLocalStorage } from 'async_hooks';
import { GAME_CONFIG } from './gameConfig';
import { createLogger } from '@/lib/logger';
import { buildTranslationPrompt } from '@/lib/daily/translationPrompt';
import { checkTranslationScript, languageFor } from '@/lib/daily/translationScript';

const log = createLogger('daily/translate');

const GEMINI_API_KEY = process.env.GEMINI_KEY;

export const translationContext = new AsyncLocalStorage<{ isPeek: boolean }>();
const CACHE_MISS_PEEK_ERROR = 'CACHE_MISS_PEEK';

/** Initial attempt plus one correction round fed the rejection reasons. */
const MAX_ATTEMPTS = 2;

export interface TranslatedGameData {
    theme: string;
    words: string[];
    hints: string[];
    cachedAt?: string;
}

/**
 * Thrown when every attempt came back in the wrong script or the wrong shape.
 *
 * It is a throw rather than a `null` return on purpose: `unstable_cache` stores
 * a returned value for 24h but never stores a rejection, so a drifted
 * generation costs this one request an English fallback instead of costing the
 * locale its whole day.
 */
export class TranslationRejectedError extends Error {
    readonly reasons: string[];

    constructor(locale: string, reasons: string[]) {
        super(`Translation to ${locale} rejected: ${reasons.join('; ')}`);
        this.name = 'TranslationRejectedError';
        this.reasons = reasons;
    }
}

function stripCodeFence(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith('```json')) {
        return trimmed.replace(/^```json/, '').replace(/```$/, '');
    }
    if (trimmed.startsWith('```')) {
        return trimmed.replace(/^```/, '').replace(/```$/, '');
    }
    return trimmed;
}

interface ParsedTranslation {
    theme: string;
    words: string[];
    hints: string[];
}

function parseTranslation(text: string): ParsedTranslation | null {
    const parsed: unknown = JSON.parse(stripCodeFence(text));
    if (typeof parsed !== 'object' || parsed === null) return null;

    const candidate = parsed as Partial<ParsedTranslation>;
    if (typeof candidate.theme !== 'string') return null;
    if (!Array.isArray(candidate.words) || !Array.isArray(candidate.hints)) return null;

    return { theme: candidate.theme, words: candidate.words, hints: candidate.hints };
}

/** One Gemini round trip. Returns the raw model text, or null on a transport failure. */
async function requestTranslation(prompt: string, gameId: string, locale: string): Promise<string | null> {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GAME_CONFIG.AI_HINT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                // JSON mode removes the code-fence guessing, and a low
                // temperature keeps the model from wandering out of the target
                // script mid-sentence.
                generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
            }),
        }
    );

    if (!response.ok) {
        log.error('translate', 'Gemini API returned an error', {
            game_id: gameId,
            locale,
            status: response.status,
            response: (await response.text()).slice(0, 300),
        });
        return null;
    }

    const data = await response.json();
    const text: unknown = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' ? text : null;
}

/** Records a successful generation so the admin dashboard can count them. */
async function recordGeneration(gameId: string, locale: string): Promise<void> {
    try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        await supabaseAdmin.from('translation_generations').insert({ game_id: gameId, locale });
    } catch (dbError) {
        log.error('translate', 'Failed to record translation generation', { game_id: gameId, locale }, dbError);
    }
}

// Internal function to perform the actual translation
async function translateDailyGame(gameId: string, words: string[], theme: string, locale: string): Promise<TranslatedGameData | null> {
    // --- Verify Cache Miss & Log ---
    const context = translationContext.getStore();
    if (context?.isPeek) {
        throw new Error(CACHE_MISS_PEEK_ERROR);
    }

    if (!GEMINI_API_KEY) {
        log.warn('translate', 'GEMINI_KEY not set, skipping translation', { game_id: gameId, locale });
        return null;
    }

    let rejectionReasons: string[] = [];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const prompt = buildTranslationPrompt({ words, theme, locale, rejectionReasons });

        let text: string | null;
        try {
            text = await requestTranslation(prompt, gameId, locale);
        } catch (e) {
            log.error('translate', 'Translation request failed', { game_id: gameId, locale, attempt }, e);
            return null;
        }

        if (!text) return null;

        let parsed: ParsedTranslation | null;
        try {
            parsed = parseTranslation(text);
        } catch (e) {
            log.error('translate', 'Gemini returned unparseable translation JSON', {
                game_id: gameId,
                locale,
                attempt,
                response: text.slice(0, 300),
            }, e);
            return null;
        }

        if (!parsed) {
            log.warn('translate', 'Gemini returned an unexpected translation shape', { game_id: gameId, locale, attempt });
            return null;
        }

        // The guard this whole path exists for: the model drifts between
        // right-to-left languages and used to leak Arabic into Hebrew hints.
        const check = checkTranslationScript(parsed, locale, words.length);

        if (check.ok) {
            if (attempt > 1) {
                log.warn('translate', 'Translation accepted only after a corrected retry', {
                    game_id: gameId,
                    locale,
                    language: languageFor(locale),
                    first_attempt_reasons: rejectionReasons.join(' | '),
                });
            }
            await recordGeneration(gameId, locale);
            return { ...parsed, cachedAt: new Date().toISOString() };
        }

        rejectionReasons = check.reasons;
        log.warn('translate', `Translation failed the ${languageFor(locale)} script check, attempt ${attempt}/${MAX_ATTEMPTS}`, {
            game_id: gameId,
            locale,
            reasons: check.reasons.join(' | '),
        });
    }

    log.error('translate', `Every translation attempt failed the ${languageFor(locale)} script check, serving English instead`, {
        game_id: gameId,
        locale,
        attempts: MAX_ATTEMPTS,
        reasons: rejectionReasons.join(' | '),
    });

    throw new TranslationRejectedError(locale, rejectionReasons);
}

export const getCachedTranslatedDailyGame = unstable_cache(
    async (gameId: string, words: string[], theme: string, locale: string) => {
        const isPeek = translationContext.getStore()?.isPeek;
        if (!isPeek) {
            log.debug('cache', 'Cache miss, translating daily game', { game_id: gameId, locale });
        }
        return await translateDailyGame(gameId, words, theme, locale);
    },
    ['daily-translation'], // Revalidation tag
    {
        tags: ['daily-game'], // Additional tags if needed
        revalidate: 86400 // Cache for 24 hours
    }
);
