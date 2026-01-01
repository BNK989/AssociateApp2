import { createAdminClient } from './supabase-admin';
import { GAME_CONFIG } from './gameConfig';

export async function generateDailyHints(words: string[], theme: string): Promise<string[] | null> {
    const GEMINI_API_KEY = process.env.GEMINI_KEY;
    if (!GEMINI_API_KEY) {
        console.warn("GEMINI_KEY not set, skipping hint generation.");
        return null;
    }

    const prompt = `
    You are generating hints for a word association game.
    Theme: "${theme}"
    Words: ${JSON.stringify(words)}

    For EACH word in the list, provide a short, cryptic but helpful hint.
    The hint must NOT contain the word itself or variations of it.
    
    CRITICAL: Return a JSON array of OBJECTS, where each object has "word" and "hint" properties.
    Ensure strict alignment with the input list.
    
    Example output format:
    [
        { "word": "Apple", "hint": "Red fruit" },
        { "word": "Banana", "hint": "Yellow curve" }
    ]
    `;

    let text: string | undefined;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GAME_CONFIG.AI_HINT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        response_mime_type: "application/json"
                    }
                })
            }
        );

        if (!response.ok) {
            console.error("Gemini API error:", await response.text());
            return null;
        }

        const data = await response.json();
        text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) return null;

        // Clean up markdown/whitespace
        let cleanText = text.trim();
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '');
        } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```/, '').replace(/```$/, '');
        }

        // Find JSON array if surrounded by text
        const firstBracket = cleanText.indexOf('[');
        const lastBracket = cleanText.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1) {
            cleanText = cleanText.substring(firstBracket, lastBracket + 1);
        }

        const rawHints = JSON.parse(cleanText);

        if (!Array.isArray(rawHints)) {
            console.warn("Generated hints is not an array:", rawHints);
            return null;
        }

        // Align hints with original words array
        // We expect [{word: "...", hint: "..."}]
        // We want to return string[] matching the order of 'words'

        const hintsMap = new Map<string, string>();
        rawHints.forEach((item: any) => {
            if (item && item.word && item.hint) {
                // Normalize keys for matching (lowercase?)
                // Words in game might be Case Sensitive or not, usually we want strict or relaxed.
                // Let's us lowercase for robustness.
                hintsMap.set(item.word.toLowerCase().trim(), item.hint);
            }
        });

        const alignedHints = words.map(originalWord => {
            const key = originalWord.toLowerCase().trim();
            // Clean punctuation from key if needed? "Energy." vs "Energy"
            // Try exact match first
            if (hintsMap.has(key)) return hintsMap.get(key)!;

            // Try stripping punctuation
            const strippedKey = key.replace(/[.,!?;:]/g, '');
            if (hintsMap.has(strippedKey)) return hintsMap.get(strippedKey)!;

            // Fallback: If strict mapping failed, we might check index? 
            // But prompt asked for strict objects. 
            // If missing, we return a fallback static hint placeholder or null?
            // Returning a generic string is safer than crashing logic later.
            return `Think about ${originalWord[0].toUpperCase()}...`;
        });

        return alignedHints;

    } catch (e) {
        console.error("Error generating/parsing hints:", e);
        // Log the problematic text (truncated)
        if (typeof text !== 'undefined') {
            console.error("Raw Text Start:", text.substring(0, 200));
            console.error("Raw Text End:", text.substring(text.length - 200));
        }
        return null;
    }
}

/**
 * Checks if hints exist for the given daily game. If not, generates and saves them.
 * This is designed to be called server-side when loading the daily game.
 */
export async function ensureDailyHints(gameId: string, words: string[], theme: string) {
    try {
        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from('daily_games')
            .select('hints')
            .eq('id', gameId)
            .single();

        if (error) {
            console.error("Error checking hints:", error);
            return;
        }

        if (data.hints && Array.isArray(data.hints) && data.hints.length > 0) {
            return;
        }

        // Generate
        console.log(`Generating hints for Daily Game ${gameId}...`);
        const hints = await generateDailyHints(words, theme);

        if (hints) {
            const { error: updateError } = await supabase
                .from('daily_games')
                .update({ hints })
                .eq('id', gameId);

            if (updateError) {
                console.error("Error saving hints:", updateError);
            }
            return hints;
        }
    } catch (err) {
        console.error("Error in ensureDailyHints:", err);
    }
}
