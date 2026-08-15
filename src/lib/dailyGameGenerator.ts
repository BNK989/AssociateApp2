import { createAdminClient } from './supabase-admin';
import { GAME_CONFIG } from './gameConfig';

export interface DailyGameData {
    id?: string;
    play_date: string;
    theme: string;
    words: string[];
    hints: string[];
    connection_scores: number[];
    created_at?: string;
}

export const FALLBACK_DAILY_GAMES: Omit<DailyGameData, 'id' | 'play_date' | 'created_at'>[] = [
    {
        theme: "Space & Stars",
        words: ["Star", "Light", "Bulb", "Idea", "Brain"],
        hints: [
            "A celestial body that shines bright in the night sky",
            "Visible radiation that illuminates darkness",
            "A glass container producing illumination when energized",
            "A thought or suggestion formed in the mind",
            "The central organ of the human nervous system"
        ],
        connection_scores: [0.95, 0.85, 0.9, 0.95, 1.0]
    },
    {
        theme: "Ocean & Life",
        words: ["Cloud", "Rain", "Water", "Ocean", "Whale"],
        hints: [
            "A visible mass of condensed water vapor floating in the atmosphere",
            "Precipitation falling from clouds in liquid drops",
            "Essential liquid forming rivers, lakes, and seas",
            "Vast expanse of salt water covering most of the Earth",
            "Giant marine mammal swimming in deep marine waters"
        ],
        connection_scores: [0.9, 0.95, 0.95, 0.85, 1.0]
    },
    {
        theme: "Morning Routine",
        words: ["Sun", "Morning", "Coffee", "Bean", "Stalk"],
        hints: [
            "The star at the center of our solar system providing daylight",
            "The early period of the day from sunrise to noon",
            "A brewed drink prepared from roasted beans enjoyed at dawn",
            "The seed of a leguminous plant or coffee plant",
            "The main stem of a herbaceous plant"
        ],
        connection_scores: [0.85, 0.9, 0.95, 0.9, 1.0]
    },
    {
        theme: "Baking & Treats",
        words: ["Apple", "Pie", "Crust", "Earth", "World"],
        hints: [
            "The crisp round fruit often baked into sweet pastries",
            "A baked dish of fruit or meat with a pastry base",
            "The hard outer layer of a baked pie or bread",
            "The terrestrial planet we live on with a rocky outer shell",
            "The globe and all living human society"
        ],
        connection_scores: [0.95, 0.9, 0.85, 0.8, 1.0]
    },
    {
        theme: "Forest Adventure",
        words: ["Tree", "Wood", "Campfire", "Smoke", "Signal"],
        hints: [
            "A tall perennial plant with a trunk and branches",
            "The hard fibrous material derived from trees",
            "An outdoor fire lit at a night campsite made of timber",
            "Visible vapor and gas produced by burning campfire wood",
            "A gesture or indicator sent to convey information"
        ],
        connection_scores: [0.9, 0.95, 0.9, 0.85, 1.0]
    }
];

/**
 * Gets a deterministic fallback daily game based on date string (YYYY-MM-DD)
 */
export function getFallbackDailyGame(dateStr: string): Omit<DailyGameData, 'id' | 'play_date' | 'created_at'> {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
        hash = (hash << 5) - hash + dateStr.charCodeAt(i);
        hash |= 0;
    }
    const index = Math.abs(hash) % FALLBACK_DAILY_GAMES.length;
    return FALLBACK_DAILY_GAMES[index];
}

/**
 * Uses Gemini API to generate a structured Daily Game word chain with hints & connection scores.
 */
export async function fetchAIGeneratedDailyGame(dateStr: string): Promise<Omit<DailyGameData, 'id' | 'play_date' | 'created_at'> | null> {
    const GEMINI_API_KEY = process.env.GEMINI_KEY;
    if (!GEMINI_API_KEY) {
        console.warn("GEMINI_KEY not set, using fallback generator.");
        return null;
    }

    const modelsToTry = [
        GAME_CONFIG.AI_HINT_MODEL,
        GAME_CONFIG.AI_HINT_BACKUP_MODEL,
        "gemma-4-26b-a4b-it",
        "gemini-2.5-flash-lite"
    ];

    const prompt = `
You are generating a daily word association game for date "${dateStr}".

REQUIREMENTS:
1. "theme": A creative, fun subject title (2-4 words, e.g. "Cosmic Journey", "Culinary Marvels", "Deep Sea Discovery").
2. "words": Array of 5 to 6 clear, uppercase-first English words forming a logical word association chain.
   Example: ["Sun", "Morning", "Coffee", "Bean", "Stalk"]
3. "hints": Array of strings matching the words array length.
   - For the last word (Word N), hint is a clear definition.
   - For any other word (Word i), the hint describes Word i in relation to Word i+1 (the next word in the array).
   - DO NOT use meta-phrases like "the next word", "the following word", "below". Refer to the concept naturally.
4. "connection_scores": Array of numbers between 0.5 and 1.0 matching the words array length.

Return ONLY a valid JSON object matching this structure:
{
  "theme": "Theme Name",
  "words": ["Word1", "Word2", "Word3", "Word4", "Word5"],
  "hints": ["Hint 1", "Hint 2", "Hint 3", "Hint 4", "Hint 5"],
  "connection_scores": [0.9, 0.85, 0.9, 0.95, 1.0]
}
`;

    for (const model of modelsToTry) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                }
            );

            if (!response.ok) {
                console.warn(`Gemini model ${model} returned HTTP ${response.status}`);
                continue;
            }

            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawText) continue;

            let cleanText = rawText.trim();
            if (cleanText.startsWith('```json')) {
                cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '');
            } else if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```/, '').replace(/```$/, '');
            }

            const firstBrace = cleanText.indexOf('{');
            const lastBrace = cleanText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                cleanText = cleanText.substring(firstBrace, lastBrace + 1);
            }

            const parsed = JSON.parse(cleanText);

            if (
                parsed &&
                typeof parsed.theme === 'string' &&
                Array.isArray(parsed.words) &&
                parsed.words.length >= 4 &&
                Array.isArray(parsed.hints) &&
                parsed.hints.length === parsed.words.length
            ) {
                const connection_scores = Array.isArray(parsed.connection_scores) && parsed.connection_scores.length === parsed.words.length
                    ? parsed.connection_scores.map((s: any) => typeof s === 'number' ? Math.max(0.1, Math.min(1.0, s)) : 0.8)
                    : parsed.words.map(() => 0.85);

                return {
                    theme: parsed.theme.trim(),
                    words: parsed.words.map((w: string) => String(w).trim()),
                    hints: parsed.hints.map((h: string) => String(h).trim()),
                    connection_scores
                };
            }
        } catch (err) {
            console.warn(`Error generating daily game with model ${model}:`, err);
        }
    }

    return null;
}

/**
 * Generates (via AI or deterministic fallback) and stores a Daily Game in Supabase for the given play_date.
 * Concurrent requests for the same date will safely fetch the existing game if already inserted.
 */
export async function generateAndStoreDailyGame(dateStr: string): Promise<DailyGameData> {
    const supabase = createAdminClient();

    // 1. Check if game already exists for this date
    const { data: existingGame } = await supabase
        .from('daily_games')
        .select('*')
        .eq('play_date', dateStr)
        .maybeSingle();

    if (existingGame) {
        return existingGame as DailyGameData;
    }

    // 2. Generate content via AI or Fallback
    const aiContent = await fetchAIGeneratedDailyGame(dateStr);
    const gameContent = aiContent || getFallbackDailyGame(dateStr);

    // 3. Save to Supabase daily_games table
    const { data: insertedGame, error: insertError } = await supabase
        .from('daily_games')
        .insert({
            play_date: dateStr,
            theme: gameContent.theme,
            words: gameContent.words,
            hints: gameContent.hints,
            connection_scores: gameContent.connection_scores
        })
        .select('*')
        .single();

    if (insertError) {
        console.warn("Insert conflict or error in generateAndStoreDailyGame, checking if game was created concurrently:", insertError);
        // In case another request created it concurrently, re-fetch
        const { data: reFetchedGame } = await supabase
            .from('daily_games')
            .select('*')
            .eq('play_date', dateStr)
            .maybeSingle();

        if (reFetchedGame) {
            return reFetchedGame as DailyGameData;
        }

        // Return volatile object with dateStr if DB write somehow fails completely
        return {
            play_date: dateStr,
            ...gameContent
        };
    }

    return insertedGame as DailyGameData;
}
