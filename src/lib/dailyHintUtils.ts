import { createAdminClient } from './supabase-admin';
import { GAME_CONFIG } from './gameConfig';

export async function generateDailyHints(words: string[], theme: string): Promise<{ hints: string[], connectionScores: number[] } | null> {
    const GEMINI_API_KEY = process.env.GEMINI_KEY;
    if (!GEMINI_API_KEY) {
        console.warn("GEMINI_KEY not set, skipping hint generation.");
        return null;
    }

    const prompt = `
    You are generating hints and connection scores for a word association game.
    Theme: "${theme}"
    Words: ${JSON.stringify(words)}

    CRITICAL: Understand the Game Flow
    The words are provided in an array: [Word 0, Word 1, ..., Word N].
    The game is played **UPWARDS**, from the last word (Word N) to the first (Word 0).
    - Word N is the starting clue (revealed).
    - Players guess Word N-1 using Word N as context.
    - Players guess Word N-2 using Word N-1 as context.
    - ...

    INSTRUCTIONS:
    For EACH word in the list, provide:
    1. A HINT:
       - For the **Last Word (Word N)**: Provide a standalone definition.
       - For **All Other Words (Word i)**: The hint MUST describe "Word i" by relating it to the **Next Word in the list (Word i+1)** (which is the context).
       - **IMPORTANT**: Do NOT use phrases like "the next word", "the previous word", "the word below", or "the following word".
       - INSTEAD: Refer to the context word (Word i+1) by its meaning or concept, or even explicitly if needed (though subtle is better).
       - BAD HINT: "The next word is a type of this."
       - BAD HINT: "Found in the next."
       - GOOD HINT (Context: Pie): "This round fruit is the main ingredient in that baked pastry." (Target: Apple)
       - GOOD HINT (Context: Ocean): "These gigantic mammals swim in those deep blue waters." (Target: Whales)
    
    2. A CONNECTION SCORE (0.0 to 1.0):
       - Represents the strength of the link between [Word i] and [Word i+1].
       - 1.0 = Direct, Obvious (Apple -> Pie).
       - 0.5 = Thematic (Orchard -> Pie).
       - 0.1 = Weak/Abstract.
       - For the Last Word, score can be 1.0.

    Return a JSON array of OBJECTS matching the words array order.
    
    Format:
    [
        { "word": "Apple", "hint": "The fruit used in the baked dessert below", "score": 0.9 }, 
        { "word": "Pie", "hint": "A baked pastry dish", "score": 1.0 }
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
                    contents: [{ parts: [{ text: prompt }] }]
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

        const hintsMap = new Map<string, { hint: string, score: number }>();
        rawHints.forEach((item: any) => {
            if (item && item.word && item.hint) {
                hintsMap.set(item.word.toLowerCase().trim(), {
                    hint: item.hint,
                    score: typeof item.score === 'number' ? item.score : 0.5
                });
            }
        });

        const alignedHints: string[] = [];
        const alignedScores: number[] = [];

        words.forEach(originalWord => {
            const key = originalWord.toLowerCase().trim();
            const strippedKey = key.replace(/[.,!?;:]/g, '');

            let match = hintsMap.get(key) || hintsMap.get(strippedKey);

            if (match) {
                alignedHints.push(match.hint);
                alignedScores.push(match.score);
            } else {
                alignedHints.push(`Think about ${originalWord[0].toUpperCase()}...`);
                alignedScores.push(0.5); // Default medium
            }
        });

        return { hints: alignedHints, connectionScores: alignedScores };

    } catch (e) {
        console.error("Error generating/parsing hints:", e);
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
            .select('hints, connection_scores')
            .eq('id', gameId)
            .single();

        if (error) {
            console.error("Error checking hints:", error);
            return;
        }

        if (data.hints && Array.isArray(data.hints) && data.hints.length === words.length) {
            // Also return connection_scores if available (though type signature of this function might need to change)
            // Ideally we return the whole object, but maintaining compat with 'hints only' callers is key.
            // For now, let's return object if scores exist, or just hints array if that's what caller expects.
            // Actually, we should return { hints, connectionScores } if possible.
            // Let's defer return type change to avoid breaking changes if not needed.
            // But caller page.tsx expects just hints? No, it expects to assign.
            return { hints: data.hints, connectionScores: data.connection_scores };
        }

        // Generate
        console.log(`Generating hints for Daily Game ${gameId}...`);
        const result = await generateDailyHints(words, theme);

        if (result) {
            const { error: updateError } = await supabase
                .from('daily_games')
                .update({
                    hints: result.hints,
                    connection_scores: result.connectionScores
                })
                .eq('id', gameId);

            if (updateError) {
                console.error("Error saving hints:", updateError);
            }
            return result;
        }
    } catch (err) {
        console.error("Error in ensureDailyHints:", err);
    }
}
