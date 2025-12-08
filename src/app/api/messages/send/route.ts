import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
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
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
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
        const body = await request.json();
        const { potentialValue, ...messageData } = body;

        // Perform the insert (using the authenticated user's ID for security)
        const { error } = await supabase
            .from('messages')
            .insert({
                ...messageData,
                user_id: user.id // Enforce authorship
            });

        if (error) {
            console.error("Server-side insert error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Call increment_team_pot if potentialValue is provided
        if (typeof body.potentialValue === 'number') {
            const { error: rpcError } = await supabase.rpc('increment_team_pot', {
                game_id_param: body.game_id,
                amount: body.potentialValue
            });
            if (rpcError) {
                console.error("Server-side RPC error:", rpcError);
                // We don't fail the whole request since message send succeeded, but we should log it
            }
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("API Error:", err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
