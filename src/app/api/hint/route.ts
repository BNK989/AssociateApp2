import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for server-side usage
// Note: We use the service role key if available for bypassing RLS, 
// but here we can probably just use the anon key if RLS allows reading messages.
// However, for an API route, it's safer to use the standard client.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(request: Request) {
    try {
        const { gameId, targetMessageId } = await request.json();

        if (!gameId || !targetMessageId) {
            return NextResponse.json({ error: 'Missing gameId or targetMessageId' }, { status: 400 });
        }

        // 1. Fetch the target message and the one before it (context)
        // We need to fetch all messages for the game to find the sequence
        // (Optimisation: Could fetch just the specific ones if we had a sequence number, 
        // but for now fetching all is fine for small games)
        const { data: messages, error: msgError } = await supabase
            .from('messages')
            .select('*')
            .eq('game_id', gameId)
            .order('created_at', { ascending: true });

        if (msgError || !messages) {
            return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
        }

        const targetIndex = messages.findIndex((m: any) => m.id === targetMessageId);
        if (targetIndex === -1) {
            return NextResponse.json({ error: 'Target message not found' }, { status: 404 });
        }

        const targetMessage = messages[targetIndex];
        const previousMessage = targetIndex > 0 ? messages[targetIndex - 1] : null;

        // 2. Check for API Key
        if (!GEMINI_API_KEY) {
            console.warn("GEMINI_API_KEY is missing. Returning mock hint.");
            return NextResponse.json({
                hint: `[MOCK HINT] The word starts with ${targetMessage.content.charAt(0)}... (Configure GEMINI_API_KEY for real hints)`
            });
        }

        // 3. Construct Prompt
        const targetWord = targetMessage.content;
        const contextWord = previousMessage ? previousMessage.content : "Start of game";

        const prompt = `Give a subtle hint for the word "${targetWord}" which is associated with "${contextWord}". 
        The hint should be short, cryptic but helpful. 
        CRITICAL INSTRUCTION: Do NOT use the word "${targetWord}" or any of its variations in the hint itself.
        Example format: "Think about..." or "Related to..."`;

        // 4. Call Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini API Error:", errorData);
            return NextResponse.json({ error: 'Failed to generate hint from AI' }, { status: 500 });
        }

        const data = await response.json();
        const hint = data.candidates?.[0]?.content?.parts?.[0]?.text || "No hint available.";

        return NextResponse.json({ hint });

    } catch (error) {
        console.error("API Handler Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
