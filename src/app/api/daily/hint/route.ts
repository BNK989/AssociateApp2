import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { headers } from 'next/headers';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const GEMINI_API_KEY = process.env.GEMINI_KEY;

export async function POST(request: Request) {
    try {
        const { date, targetIndex } = await request.json();
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for') || 'unknown';

        if (!date || targetIndex === undefined) {
            return NextResponse.json({ error: 'Missing date or targetIndex' }, { status: 400 });
        }

        // 1. Get User from Auth Header (Client must pass it, or we rely on IP/Client Claim if using Anon Key)
        // Ideally we use getUser() with the authorization header passed from client
        // But for now, we'll try to extract it if possible, or fail if "Guest" check is required.
        // Wait, DailyGameClient doesn't send Auth Headers by default in fetch?
        // We need to verify user identity. 
        // Let's assume standard supabase auth cookie is passed if we use generic client? 
        // No, fetch needs credentials include.
        // BETTER: Retrieve user from access_token in Authorization header.

        const authHeader = headersList.get('authorization');
        let userId: string | null = null;

        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (user) userId = user.id;
        }

        // Requirement: "logged in user that is not a guest" - NOW ALLOWING GUESTS
        // If no userId, we consider it a guest request.
        // We will rely on IP limiting for guests.

        // Check if user is Guest (via metadata or email convention if any)
        // MOCK_USER in client has id 'me', we need to filter that out on Client side.
        // Real users have UUIDs.

        // 2. Fetch Daily Game Data
        const { data: dailyGame, error: gameError } = await supabase
            .from('daily_games')
            .select('*')
            .eq('play_date', date)
            .single();

        if (gameError || !dailyGame) {
            return NextResponse.json({ error: 'Daily game not found' }, { status: 404 });
        }

        const words = dailyGame.words;
        if (!words || !words[targetIndex]) {
            return NextResponse.json({ error: 'Word not found' }, { status: 404 });
        }

        const targetWord = words[targetIndex];
        const contextWord = targetIndex > 0 ? words[targetIndex - 1] : "Start of chain";

        // 3. Rate Limiting
        const gameId = dailyGame.id;

        // 3a. Per Player Limit
        // 3a. Per Player Limit (Only if logged in)
        if (userId) {
            const { count: playerUsage, error: countError } = await supabase
                .from('api_usage')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('game_id', gameId)
                .eq('endpoint', 'daily_hint');

            if (playerUsage !== null && playerUsage >= GAME_CONFIG.AI_HINT_LIMIT_PER_GAME_PLAYER) { // 5
                return NextResponse.json({ error: 'Limit reached for this game' }, { status: 429 });
            }
        }

        // 3b. Per IP Limit (Global safety)
        // Hash IP for privacy if storing, but here we just query.
        // Actually, schema has `ip_hash`.
        const ipHash = Buffer.from(ip).toString('base64'); // Simple hash/encoding

        // Check daily limit for IP
        const startOfDay = new Date().toISOString().split('T')[0];
        const { count: ipUsage } = await supabase
            .from('api_usage')
            .select('*', { count: 'exact', head: true })
            .eq('ip_hash', ipHash)
            .eq('endpoint', 'daily_hint')
            .gte('created_at', startOfDay);

        if (ipUsage !== null && ipUsage >= GAME_CONFIG.AI_HINT_LIMIT_PER_IP_DAY) { // 100
            return NextResponse.json({ error: 'Daily IP limit reached' }, { status: 429 });
        }

        // 4. Retrieve Hint
        let hint: string | null = null;

        // Check if pre-generated hints exist in the fetched dailyGame
        if (dailyGame.hints && Array.isArray(dailyGame.hints) && dailyGame.hints[targetIndex]) {
            hint = dailyGame.hints[targetIndex];
        }

        // Fallback: Generate if missing
        if (!hint) {
            if (!GEMINI_API_KEY) {
                return NextResponse.json({ hint: `[MOCK] First letter is ${targetWord[0].toUpperCase()}` });
            }

            const prompt = `Give a subtle hint for the word "${targetWord}" which comes after "${contextWord}" in a word association chain. 
            The hint should be short, cryptic but helpful. 
            CRITICAL INSTRUCTION: Do NOT use the word "${targetWord}" or any of its variations in the hint itself.
            Example format: "Think about..." or "Related to..."`;

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
                throw new Error('Gemini API failed');
            }

            const data = await response.json();
            hint = data.candidates?.[0]?.content?.parts?.[0]?.text || "No hint available.";
        }

        // 5. Track Usage
        const usageData: any = {
            game_id: gameId,
            endpoint: 'daily_hint',
            ip_hash: ipHash
        };
        if (userId) {
            usageData.user_id = userId;
        }

        await supabase
            .from('api_usage')
            .insert(usageData);

        return NextResponse.json({ hint });

    } catch (error) {
        console.error("Daily Hint Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
