
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hardcoded for now or fetch from DB config
const GAME_CONFIG = {
    AI_HINT_MODEL: 'gemma-3-12b-it', // Fallback to stable model
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const GEMINI_API_KEY = Deno.env.get('GEMINI_KEY');
        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_KEY is missing');
        }

        // Get tomorrow's date to pre-generate
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Calculate max date (Today + 3 days) to prevent generating too far ahead
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + 3);
        const maxDateStr = maxDate.toISOString().split('T')[0];

        // Fetch games matching the criteria: missing hints OR missing connection scores
        // We use .or() with the format: column.operator.value,column.operator.value
        // Priority: Upcoming games starting from TODAY up to TODAY+3
        const { data: games, error: fetchError } = await supabase
            .from('daily_games')
            .select('*')
            .or('hints.is.null,connection_scores.is.null')
            .gte('play_date', new Date().toISOString().split('T')[0]) // From Today
            .lte('play_date', maxDateStr) // Up to Today + 3 days
            .order('play_date', { ascending: true })
            .limit(10); // Process batch of 10 to avoid timeouts

        if (fetchError) throw fetchError;

        console.log(`Found ${games?.length ?? 0} games pending generation.`);

        if (!games || games.length === 0) {
            return new Response(JSON.stringify({ message: "No games pending generation." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const results = [];

        for (const game of games) {
            console.log(`Generating for game ${game.id} (${game.play_date})`);
            const words = game.words;
            const theme = game.theme;

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
            `; console.log(`[DEBUG] Game ${game.play_date}: Sending Prompt...`);
            console.log(`[DEBUG] Prompt Content: \n`, prompt);

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
                console.error(`[ERROR] Gemini API failed for game ${game.id}: ${await response.text()}`);
                continue;
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            console.log(`[DEBUG] Game ${game.play_date}: Raw Gemini Response:\n`, text);

            if (!text) {
                console.warn(`[WARN] No text returned from Gemini for game ${game.id}`);
                continue;
            }

            let cleanText = text.trim();
            if (cleanText.startsWith('```json')) {
                cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '');
            } else if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```/, '').replace(/```$/, '');
            }

            // Extract JSON array
            const firstBracket = cleanText.indexOf('[');
            const lastBracket = cleanText.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1) {
                cleanText = cleanText.substring(firstBracket, lastBracket + 1);
            }

            try {
                const rawHints = JSON.parse(cleanText);
                console.log(`[DEBUG] Game ${game.play_date}: Parsed JSON elements: ${rawHints.length}`);

                if (!Array.isArray(rawHints)) {
                    console.error(`[ERROR] Parsed JSON is not an array:`, rawHints);
                    continue;
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

                words.forEach((originalWord: string) => {
                    const key = originalWord.toLowerCase().trim();
                    const strippedKey = key.replace(/[.,!?;:]/g, '');

                    let match = hintsMap.get(key) || hintsMap.get(strippedKey);

                    if (match) {
                        alignedHints.push(match.hint);
                        alignedScores.push(match.score);
                    } else {
                        console.warn(`[WARN] No match found for word "${originalWord}", using fallback.`);
                        alignedHints.push(`Think about ${originalWord[0].toUpperCase()}...`);
                        alignedScores.push(0.5);
                    }
                });

                console.log(`[DEBUG] Game ${game.play_date}: Aligned Scores to Update:`, JSON.stringify(alignedScores));

                // Update DB
                const { error: updateError } = await supabase
                    .from('daily_games')
                    .update({
                        hints: alignedHints,
                        connection_scores: alignedScores
                    })
                    .eq('id', game.id);

                if (updateError) {
                    console.error(`[ERROR] DB Update failed for game ${game.id}:`, updateError);
                } else {
                    console.log(`[SUCCESS] Updated game ${game.play_date} with hints and scores.`);
                    results.push({ id: game.id, status: 'updated' });
                }

            } catch (e) {
                console.error(`[ERROR] Failed to parse JSON or process game ${game.id}:`, e);
            }
        }

        return new Response(JSON.stringify({ processed: results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
})
