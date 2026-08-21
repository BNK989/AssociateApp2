import type { SupabaseClient } from '@supabase/supabase-js';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/game/action').child('hint');

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** How much of a response body to keep when logging a failure. */
const LOG_PREVIEW_CHARS = 300;

function buildPrompt(word: string): string {
    return `Give a short, cryptic but helpful single-sentence hint for the word or phrase: "${word}". Do not use the word itself. Max 12 words.`;
}

type GenerateArgs = {
    word: string;
    gameId: string;
    userId: string;
    ipHash: string;
    /** Service-role client, so usage rows are written past RLS. */
    adminSupabase: SupabaseClient;
};

/**
 * Asks Gemini for a hint, trying the configured model then its backup.
 *
 * Returns null rather than throwing when every model fails — a missing AI hint
 * degrades to a generated fallback and must never fail the player's request.
 * Usage is recorded only on success, so a failed call does not consume quota.
 */
export async function generateAiHint({
    word,
    gameId,
    userId,
    ipHash,
    adminSupabase,
}: GenerateArgs): Promise<string | null> {
    const apiKey = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
        log.error('config', 'Missing GEMINI_KEY / GEMINI_API_KEY environment variable, cannot generate AI hints', { game_id: gameId });
        return null;
    }

    const models = [GAME_CONFIG.AI_HINT_MODEL, GAME_CONFIG.AI_HINT_BACKUP_MODEL].filter(Boolean);
    log.debug('select_models', 'Models to try', { game_id: gameId, models: models.join(', ') });

    for (const model of models) {
        try {
            log.debug('call_model', 'Attempting model', { game_id: gameId, model });

            const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: buildPrompt(word) }] }] }),
            });

            log.debug('call_model', 'Model responded', { game_id: gameId, model, status: response.status });

            if (!response.ok) {
                const errorText = await response.text();
                log.error('call_model', 'Model returned an error response, trying next model', {
                    game_id: gameId, model, response: errorText.slice(0, LOG_PREVIEW_CHARS),
                });
                continue;
            }

            const data = await response.json();
            const hint = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (!hint) {
                log.warn('call_model', 'Model returned valid JSON but no text content', { game_id: gameId, model });
                continue;
            }

            log.debug('call_model', 'Hint extracted', { game_id: gameId, model, hint });

            await adminSupabase.from('api_usage').insert({
                user_id: userId,
                game_id: gameId,
                endpoint: 'gemini-hint',
                model,
                ip_hash: ipHash,
            });

            return hint;
        } catch (error) {
            log.error('call_model', 'Model call threw, trying next model', { game_id: gameId, model }, error);
        }
    }

    return null;
}
