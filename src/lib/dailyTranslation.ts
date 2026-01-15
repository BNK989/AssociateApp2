import { unstable_cache } from 'next/cache';
import { AsyncLocalStorage } from 'async_hooks';
import { GAME_CONFIG } from './gameConfig';

const GEMINI_API_KEY = process.env.GEMINI_KEY;

export const translationContext = new AsyncLocalStorage<{ isPeek: boolean }>();
const CACHE_MISS_PEEK_ERROR = 'CACHE_MISS_PEEK';

export interface TranslatedGameData {
    theme: string;
    words: string[];
    hints: string[];
    cachedAt?: string;
}

// Internal function to perform the actual translation
async function translateDailyGame(gameId: string, words: string[], theme: string, locale: string): Promise<TranslatedGameData | null> {
    // --- Verify Cache Miss & Log ---
    const context = translationContext.getStore();
    if (context?.isPeek) {
        throw new Error(CACHE_MISS_PEEK_ERROR);
    }

    if (!GEMINI_API_KEY) {
        console.warn("GEMINI_KEY not set, skipping translation.");
        return null;
    }

    const prompt = `
    You are a professional translator and extensive game designer.
    Your task is to translate a "Word Association Chain" game from English to a target locale.
    
    Target Locale: "${locale}"
    Original Theme: "${theme}"
    Original Words: ${JSON.stringify(words)}

    INSTRUCTIONS:
    1. Translate the Theme to the target locale.
    2. Translate the Words to the target locale. 
       - CRITICAL: The translated words MUST maintain a strong associative chain logic in the target culture/language.
       - Word 1 relates to Word 2, Word 2 to Word 3, etc.
       - If a direct translation breaks the association, choose a culturally appropriate synonym or related concept that keeps the chain intact.
    3. Generate NEW Hints for the translated words.
       - The hints must be in the target locale.
       - CRITICAL: Hints must NOT contain the target word itself or any of its root variations.
       - Hints should be cryptic but helpful (like a crossword clue).
    
    OUTPUT FORMAT:
    Return ONLY a raw JSON object (no markdown, no code blocks) with the following structure:
    {
        "theme": "Translated Theme",
        "words": ["TranslatedWord1", "TranslatedWord2", ...],
        "hints": ["HintForWord1", "HintForWord2", ...]
    }
    `;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GAME_CONFIG.AI_HINT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        if (!response.ok) {
            console.error("Gemini API translation error:", await response.text());
            return null;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) return null;

        // Clean up markdown/whitespace if model adds it
        let cleanText = text.trim();
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '');
        } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```/, '').replace(/```$/, '');
        }

        const parsed = JSON.parse(cleanText);

        // Simple validation
        if (!parsed.theme || !Array.isArray(parsed.words) || !Array.isArray(parsed.hints)) {
            console.warn("Invalid translation format:", parsed);
            return null;
        }

        // --- LOG GENERATION TO DB (Verifiable Proof) ---
        try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            await supabaseAdmin.from('translation_generations').insert({
                game_id: gameId,
                locale: locale
            });
        } catch (dbError) {
            console.error("Failed to log translation generation:", dbError);
        }

        return { ...parsed, cachedAt: new Date().toISOString() } as TranslatedGameData;

    } catch (e) {
        console.error("Error translating daily game:", e);
        return null;
    }
}

export const getCachedTranslatedDailyGame = unstable_cache(
    async (gameId: string, words: string[], theme: string, locale: string) => {
        const isPeek = translationContext.getStore()?.isPeek;
        if (!isPeek) {
            console.log(`[Cache Miss] Translating game ${gameId} to ${locale}`);
        }
        return await translateDailyGame(gameId, words, theme, locale);
    },
    ['daily-translation'], // Revalidation tag
    {
        tags: ['daily-game'], // Additional tags if needed
        revalidate: 86400 // Cache for 24 hours
    }
);
