import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Fix: Await cookies() to satisfy Next.js 15+ requirements if applicable, 
    // or just standard usage.
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Ignored in route handlers usually
                    }
                },
            },
        }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Parallelize fetches for performance
        const [gameResult, playersResult, messagesResult] = await Promise.all([
            // 1. Fetch Game
            supabase
                .from('games')
                .select('*')
                .eq('id', id)
                .single(),

            // 2. Fetch Players
            supabase
                .from('game_players')
                .select(`
                    user_id,
                    score,
                    joined_at,
                    consecutive_correct_guesses,
                    has_left,
                    profiles:user_id (
                        username,
                        avatar_url
                    )
                `)
                .eq('game_id', id)
                .order('joined_at', { ascending: true }),

            // 3. Fetch Messages
            supabase
                .from('messages')
                .select(`
                    *,
                    profiles:user_id (
                        username,
                        avatar_url
                    )
                `)
                .eq('game_id', id)
                .order('created_at', { ascending: true })
        ]);

        if (gameResult.error) throw new Error(gameResult.error.message);
        if (playersResult.error) throw new Error(playersResult.error.message);
        if (messagesResult.error) throw new Error(messagesResult.error.message);

        return NextResponse.json({
            game: gameResult.data,
            players: playersResult.data,
            messages: messagesResult.data,
            timestamp: new Date().toISOString()
        });

    } catch (err: any) {
        console.error("Game Fetch API Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
