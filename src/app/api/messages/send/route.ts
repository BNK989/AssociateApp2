import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/messages/send');

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

        // Call RPC for atomic insert and logic
        const { error } = await supabase.rpc('send_game_message', {
            p_game_id: messageData.game_id,
            p_content: messageData.content,
            p_cipher_length: messageData.cipher_length,
            p_cipher_text: messageData.cipher_text,
            p_potential_value: typeof potentialValue === 'number' ? potentialValue : 0
        });

        if (error) {
            log.error('send_message', 'Server-side message send failed', { game_id: messageData.game_id, user_id: user.id }, error);
            // Check for custom exception message
            if (error.message.includes('already exists')) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        log.error('send_message', 'Unhandled error in send handler', undefined, err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
