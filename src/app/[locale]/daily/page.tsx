import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import DailyGameClient from './DailyGameClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DailyGamePage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params;
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

    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch today's daily game (Base English Data)
    let { data: dailyGame, error } = await supabase
        .from('daily_games')
        .select('*')
        .eq('play_date', todayStr)
        .single();

    if (error || !dailyGame) {
        console.warn("No pre-planned daily game found in DB for date:", todayStr, error);
        const { generateAndStoreDailyGame } = await import('@/lib/dailyGameGenerator');
        dailyGame = await generateAndStoreDailyGame(todayStr);
    }

    if (dailyGame && (!dailyGame.hints || !Array.isArray(dailyGame.hints) || dailyGame.hints.length !== dailyGame.words.length)) {
        const { ensureDailyHints } = await import('@/lib/dailyHintUtils');
        const generatedResult = await ensureDailyHints(dailyGame.id, dailyGame.words, dailyGame.theme);
        if (generatedResult) {
            // Handle both legacy (array) and new (object) returns
            if (Array.isArray(generatedResult)) {
                dailyGame.hints = generatedResult;
            } else {
                dailyGame.hints = generatedResult.hints;
                dailyGame.connection_scores = generatedResult.connectionScores;
            }
        }
    }

    if (!dailyGame) {
        console.error("Critical error: Unable to load or generate daily game.");
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
                <h1 className="text-2xl font-bold mb-4">No Daily Game Available</h1>
                <p>Please try refreshing the page!</p>
            </div>
        );
    }

    // --- Translation Logic ---
    const SUPPORTED_DAILY_LOCALES = ['en', 'he', 'ar', 'es', 'fr', 'de', 'ro'];

    // If locale is NOT supported, we fallback to English content without redirecting
    // (User sees English UI but stays on /es/daily for example, or we could just show English content)
    let targetLocale = locale;
    if (!SUPPORTED_DAILY_LOCALES.includes(locale)) {
        targetLocale = 'en';
    }

    if (targetLocale !== 'en') {
        const { getCachedTranslatedDailyGame } = await import('@/lib/dailyTranslation');

        // Use the cache-wrapped translation
        const translated = await getCachedTranslatedDailyGame(
            dailyGame.id,
            dailyGame.words,
            dailyGame.theme,
            targetLocale
        );

        if (translated) {
            dailyGame.theme = translated.theme;
            dailyGame.words = translated.words;
            dailyGame.hints = translated.hints;
            // Ensure ID doesn't change so local storage tracks stats correctly? 
            // Actually, we might want SEPARATE stats for Hebrew vs English daily games?
            // If we keep the SAME ID, the progress "level 1, level 2" is shared.
            // But the words are different. It might break logic if user switches lang mid-game.
            // Requirement check: "prefer to not change any db datapoints".
            // If we use the same ID, the client uses `daily_game_state_YYYY-MM-DD`.
            // Ideally we suffix the date for storage key in Client if we want separate progress.
            // But let's stick to the request scope. 
            // We just serve translated content.
        } else {
            console.warn(`Translation to ${targetLocale} failed, falling back to English.`);
        }
    }

    return (
        <DailyGameClient
            dailyWords={dailyGame.words || []}
            date={dailyGame.play_date}
            theme={dailyGame.theme}
            initialHints={dailyGame.hints}
            initialConnectionScores={dailyGame.connection_scores}
        />
    );
}
