import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import DailyGameClient from './DailyGameClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DailyGamePage() {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch { }
                },
            },
        }
    );

    // Fetch today's daily game
    // We use a simple query to get the row for today
    const { data: dailyGame, error } = await supabase
        .from('daily_games')
        .select('*')
        .eq('play_date', new Date().toISOString().split('T')[0])
        .single();

    if (error || !dailyGame) {
        // Fallback or Not Found
        // For development, we inserted data for today, so it should be there.
        // If not, we could show a "Come back later" message.
        console.error("Error fetching daily game:", error);
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
                <h1 className="text-2xl font-bold mb-4">No Daily Game Found</h1>
                <p>Come back closer to the start of the day!</p>
            </div>
        );
    }

    return (
        <DailyGameClient dailyWords={dailyGame.words || []} date={dailyGame.play_date} theme={dailyGame.theme} />
    );
}
